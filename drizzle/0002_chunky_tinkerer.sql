ALTER TABLE `campaign_sends` ADD `variant` enum('a','b') DEFAULT 'a' NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `designJson` longtext;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `isAbTest` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `abSubjectB` varchar(500);--> statement-breakpoint
ALTER TABLE `campaigns` ADD `abHtmlContentB` longtext;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `abWinnerCriteria` enum('open_rate','click_rate') DEFAULT 'open_rate';