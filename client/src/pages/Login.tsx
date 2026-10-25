import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Mail } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useLocation } from "wouter";

export default function Login() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState("");

  const onSuccess = async () => {
    await utils.auth.me.invalidate();
    setLocation("/app");
  };
  const login = trpc.auth.login.useMutation({ onSuccess });
  const register = trpc.auth.register.useMutation({ onSuccess });
  const pending = login.isPending || register.isPending;
  const mutationError = login.error?.message || register.error?.message;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    if (mode === "register") {
      if (password !== confirmPassword) {
        setFormError("As senhas não coincidem.");
        return;
      }
      register.mutate({ name, email, password });
    } else {
      login.mutate({ email, password });
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-premium">
        <a
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao início
        </a>
        <div className="mb-7 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <Mail className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-semibold">
            {mode === "login" ? "Entrar no Colabix" : "Criar sua conta"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "login"
              ? "Use seu e-mail e senha para continuar."
              : "Sua organização será criada automaticamente."}
          </p>
        </div>

        <form className="space-y-4" onSubmit={submit}>
          {mode === "register" && (
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                autoComplete="name"
                maxLength={255}
                required
                value={name}
                onChange={event => setName(event.target.value)}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              maxLength={320}
              required
              value={email}
              onChange={event => setEmail(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              minLength={12}
              maxLength={128}
              required
              value={password}
              onChange={event => setPassword(event.target.value)}
            />
            {mode === "register" && (
              <p className="text-xs text-muted-foreground">
                Use pelo menos 12 caracteres.
              </p>
            )}
          </div>
          {mode === "register" && (
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirme a senha</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
                value={confirmPassword}
                onChange={event => setConfirmPassword(event.target.value)}
              />
            </div>
          )}
          {(formError || mutationError) && (
            <p role="alert" className="text-sm text-destructive">
              {formError || mutationError}
            </p>
          )}
          <Button type="submit" disabled={pending} className="w-full">
            {pending
              ? "Aguarde..."
              : mode === "login"
                ? "Entrar"
                : "Criar conta"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {mode === "login" ? "Ainda não tem uma conta?" : "Já tem uma conta?"}{" "}
          <button
            type="button"
            className="font-medium text-primary hover:underline"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setFormError("");
              login.reset();
              register.reset();
            }}
          >
            {mode === "login" ? "Criar conta" : "Entrar"}
          </button>
        </p>
      </section>
    </main>
  );
}
