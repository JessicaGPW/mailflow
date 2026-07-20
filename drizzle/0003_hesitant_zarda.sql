ALTER TABLE `campaigns` ADD `abAutoWinner` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `abTestPercent` int DEFAULT 20;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `abWaitHours` int DEFAULT 4;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `abWinnerVariant` enum('a','b');--> statement-breakpoint
ALTER TABLE `campaigns` ADD `abWinnerSentAt` datetime;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `scheduleCronTaskUid` varchar(65);