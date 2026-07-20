import { promises as dns } from "dns";

/**
 * Real DNS verification for sending domains.
 *
 * Resolves live TXT records and checks that SPF, DKIM and DMARC entries
 * exist and are well-formed. Each check returns the status plus the actual
 * records found, so the UI can show exactly what the resolver saw.
 */

export type DnsCheckStatus = "verified" | "failed";

export type DnsCheckResult = {
  status: DnsCheckStatus;
  found: string[];
  message: string;
};

export type DomainVerificationResult = {
  spf: DnsCheckResult;
  dkim: DnsCheckResult;
  dmarc: DnsCheckResult;
  allVerified: boolean;
  checkedAt: string;
};

async function resolveTxt(host: string): Promise<string[]> {
  try {
    const records = await dns.resolveTxt(host);
    // Each record can be split into chunks by the resolver — join them
    return records.map(chunks => chunks.join(""));
  } catch {
    return [];
  }
}

/** SPF include required by the platform's DNS instructions. */
export const REQUIRED_SPF_INCLUDE = "include:mailflow.com";

export async function checkSpf(domain: string, requiredInclude: string = REQUIRED_SPF_INCLUDE): Promise<DnsCheckResult> {
  const records = await resolveTxt(domain);
  const spfRecords = records.filter(r => r.toLowerCase().startsWith("v=spf1"));
  if (spfRecords.length === 0) {
    return {
      status: "failed",
      found: records.slice(0, 10),
      message: `Nenhum registro SPF (v=spf1) encontrado no TXT de ${domain}.`,
    };
  }
  if (spfRecords.length > 1) {
    return {
      status: "failed",
      found: spfRecords,
      message: "Mais de um registro SPF encontrado — apenas um registro v=spf1 é permitido por domínio.",
    };
  }
  // Compare against the platform-required include mechanism
  if (requiredInclude && !spfRecords[0].toLowerCase().includes(requiredInclude.toLowerCase())) {
    return {
      status: "failed",
      found: spfRecords,
      message: `Registro SPF encontrado, mas não contém "${requiredInclude}" conforme as instruções. Adicione o include e tente novamente.`,
    };
  }
  return {
    status: "verified",
    found: spfRecords,
    message: "Registro SPF válido e com o include exigido.",
  };
}

/** Normalize a DKIM key/record for comparison: strip whitespace and quotes. */
function normalizeDkim(value: string): string {
  return value.replace(/[\s"']/g, "");
}

export async function checkDkim(domain: string, selector: string, expectedPublicKey?: string | null): Promise<DnsCheckResult> {
  const host = `${selector}._domainkey.${domain}`;
  const records = await resolveTxt(host);
  const dkimRecords = records.filter(r => r.toLowerCase().includes("v=dkim1") || r.includes("p="));
  if (dkimRecords.length === 0) {
    return {
      status: "failed",
      found: records.slice(0, 10),
      message: `Nenhum registro DKIM encontrado em ${host}.`,
    };
  }
  const hasKey = dkimRecords.some(r => /p=[A-Za-z0-9+/=]{20,}/.test(r));
  if (!hasKey) {
    return {
      status: "failed",
      found: dkimRecords,
      message: "Registro DKIM encontrado, mas sem chave pública válida (p=).",
    };
  }
  // When the domain has a known expected key, require an exact match of the p= value
  if (expectedPublicKey) {
    const expectedKey = normalizeDkim(expectedPublicKey).match(/p=([A-Za-z0-9+/=]+)/)?.[1];
    if (expectedKey) {
      const matches = dkimRecords.some(r => normalizeDkim(r).includes(`p=${expectedKey}`));
      if (!matches) {
        return {
          status: "failed",
          found: dkimRecords,
          message: "Registro DKIM encontrado, mas a chave pública (p=) não corresponde à chave gerada para este domínio.",
        };
      }
    }
  }
  return {
    status: "verified",
    found: dkimRecords,
    message: expectedPublicKey ? "Registro DKIM válido e com a chave pública esperada." : "Registro DKIM válido encontrado.",
  };
}

export async function checkDmarc(domain: string): Promise<DnsCheckResult> {
  const host = `_dmarc.${domain}`;
  const records = await resolveTxt(host);
  const dmarcRecords = records.filter(r => r.toLowerCase().startsWith("v=dmarc1"));
  if (dmarcRecords.length === 0) {
    return {
      status: "failed",
      found: records.slice(0, 10),
      message: `Nenhum registro DMARC (v=DMARC1) encontrado em ${host}.`,
    };
  }
  const hasPolicy = /p=(none|quarantine|reject)/i.test(dmarcRecords[0]);
  if (!hasPolicy) {
    return {
      status: "failed",
      found: dmarcRecords,
      message: "Registro DMARC encontrado, mas sem política (p=) válida.",
    };
  }
  return {
    status: "verified",
    found: dmarcRecords,
    message: "Registro DMARC válido encontrado.",
  };
}

export async function verifyDomainDns(
  domain: string,
  dkimSelector: string,
  expectedDkimPublicKey?: string | null,
): Promise<DomainVerificationResult> {
  const [spf, dkim, dmarc] = await Promise.all([
    checkSpf(domain),
    checkDkim(domain, dkimSelector, expectedDkimPublicKey),
    checkDmarc(domain),
  ]);
  return {
    spf,
    dkim,
    dmarc,
    allVerified: spf.status === "verified" && dkim.status === "verified" && dmarc.status === "verified",
    checkedAt: new Date().toISOString(),
  };
}
