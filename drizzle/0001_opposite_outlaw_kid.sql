CREATE TABLE `automation_enrollments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`automationId` int NOT NULL,
	`contactId` int NOT NULL,
	`currentStep` int NOT NULL DEFAULT 0,
	`status` enum('active','completed','exited') NOT NULL DEFAULT 'active',
	`enrolledAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` datetime,
	`nextStepAt` datetime,
	CONSTRAINT `automation_enrollments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `automation_steps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`automationId` int NOT NULL,
	`stepOrder` int NOT NULL,
	`type` enum('send_email','wait','condition','add_tag','remove_tag','move_to_list') NOT NULL,
	`config` longtext NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `automation_steps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `automations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`triggerType` enum('list_subscription','email_open','link_click','specific_date') NOT NULL,
	`triggerConfig` longtext NOT NULL,
	`status` enum('active','paused','draft') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `automations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `campaign_sends` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int NOT NULL,
	`contactId` int NOT NULL,
	`status` enum('pending','sent','delivered','bounced','failed') NOT NULL DEFAULT 'pending',
	`recipientEmail` varchar(320) NOT NULL,
	`messageId` varchar(255),
	`error` text,
	`sentAt` datetime,
	`deliveredAt` datetime,
	`bouncedAt` datetime,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `campaign_sends_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`subject` varchar(500) NOT NULL,
	`preheader` varchar(500),
	`fromName` varchar(255),
	`fromEmail` varchar(320),
	`replyTo` varchar(320),
	`htmlContent` longtext,
	`textContent` longtext,
	`targetListId` int,
	`targetSegmentId` int,
	`status` enum('draft','scheduled','sending','sent','paused','failed') NOT NULL DEFAULT 'draft',
	`scheduledAt` datetime,
	`sentAt` datetime,
	`totalRecipients` int NOT NULL DEFAULT 0,
	`totalSent` int NOT NULL DEFAULT 0,
	`totalDelivered` int NOT NULL DEFAULT 0,
	`totalOpens` int NOT NULL DEFAULT 0,
	`totalUniqueOpens` int NOT NULL DEFAULT 0,
	`totalClicks` int NOT NULL DEFAULT 0,
	`totalUniqueClicks` int NOT NULL DEFAULT 0,
	`totalBounces` int NOT NULL DEFAULT 0,
	`totalUnsubscribes` int NOT NULL DEFAULT 0,
	`totalComplaints` int NOT NULL DEFAULT 0,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `campaigns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contact_list_memberships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contactId` int NOT NULL,
	`listId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `contact_list_memberships_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contact_lists` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contact_lists_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contact_tag_associations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contactId` int NOT NULL,
	`tagId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `contact_tag_associations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contact_tags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`color` varchar(7) DEFAULT '#6366f1',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `contact_tags_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`firstName` varchar(255),
	`lastName` varchar(255),
	`phone` varchar(50),
	`status` enum('subscribed','unsubscribed','bounced','complained') NOT NULL DEFAULT 'subscribed',
	`source` enum('import','manual','api','form') NOT NULL DEFAULT 'manual',
	`ipAddress` varchar(45),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contacts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `custom_field_values` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contactId` int NOT NULL,
	`fieldId` int NOT NULL,
	`value` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `custom_field_values_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `custom_fields` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`key` varchar(100) NOT NULL,
	`type` enum('text','number','date','boolean','select') NOT NULL DEFAULT 'text',
	`options` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `custom_fields_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `email_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int,
	`sendId` int,
	`contactId` int,
	`type` enum('open','click','bounce','unsubscribe','complain','delivered') NOT NULL,
	`url` varchar(2048),
	`userAgent` text,
	`ipAddress` varchar(45),
	`bounceReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `email_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `email_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int NOT NULL,
	`url` varchar(2048) NOT NULL,
	`shortId` varchar(32) NOT NULL,
	`totalClicks` int NOT NULL DEFAULT 0,
	`uniqueClicks` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `email_links_id` PRIMARY KEY(`id`),
	CONSTRAINT `email_links_shortId_unique` UNIQUE(`shortId`)
);
--> statement-breakpoint
CREATE TABLE `email_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`subject` varchar(500),
	`preheader` varchar(500),
	`htmlContent` longtext,
	`textContent` longtext,
	`thumbnailUrl` varchar(500),
	`category` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `email_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `organization_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('admin','member') NOT NULL DEFAULT 'member',
	`invitedEmail` varchar(320),
	`status` enum('active','invited','removed') NOT NULL DEFAULT 'invited',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organization_members_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`ownerId` int NOT NULL,
	`plan` enum('free','starter','pro','enterprise') NOT NULL DEFAULT 'free',
	`defaultFromName` varchar(255),
	`defaultFromEmail` varchar(320),
	`defaultReplyTo` varchar(320),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organizations_id` PRIMARY KEY(`id`),
	CONSTRAINT `organizations_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `segments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`rules` longtext NOT NULL,
	`matchType` enum('all','any') NOT NULL DEFAULT 'all',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `segments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sending_domains` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`domain` varchar(255) NOT NULL,
	`verificationStatus` enum('pending','verified','failed') NOT NULL DEFAULT 'pending',
	`dkimStatus` enum('pending','verified','failed') NOT NULL DEFAULT 'pending',
	`spfStatus` enum('pending','verified','failed') NOT NULL DEFAULT 'pending',
	`dmarcStatus` enum('pending','verified','failed') NOT NULL DEFAULT 'pending',
	`dkimPublicKey` text,
	`dkimSelector` varchar(100) DEFAULT 'mailflow',
	`isDefault` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sending_domains_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `smtp_configurations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`provider` enum('sendgrid','mailgun','ses','smtp','mailflow') NOT NULL,
	`name` varchar(255) NOT NULL,
	`apiKey` text,
	`smtpHost` varchar(255),
	`smtpPort` int,
	`smtpUsername` varchar(255),
	`smtpPassword` text,
	`fromEmail` varchar(320),
	`fromName` varchar(255),
	`replyTo` varchar(320),
	`isDefault` boolean NOT NULL DEFAULT false,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `smtp_configurations_id` PRIMARY KEY(`id`)
);
