SET @lahza_add_featured_status = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'partner_offers' AND COLUMN_NAME = 'featuredStatus') = 0, 'ALTER TABLE `partner_offers` ADD `featuredStatus` enum(\'none\',\'pending\',\'approved\',\'rejected\') NOT NULL DEFAULT \'none\'', 'SELECT 1');--> statement-breakpoint
PREPARE lahza_featured_status_stmt FROM @lahza_add_featured_status;--> statement-breakpoint
EXECUTE lahza_featured_status_stmt;--> statement-breakpoint
DEALLOCATE PREPARE lahza_featured_status_stmt;--> statement-breakpoint
SET @lahza_add_featured_requested_at = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'partner_offers' AND COLUMN_NAME = 'featuredRequestedAt') = 0, 'ALTER TABLE `partner_offers` ADD `featuredRequestedAt` timestamp', 'SELECT 1');--> statement-breakpoint
PREPARE lahza_featured_requested_at_stmt FROM @lahza_add_featured_requested_at;--> statement-breakpoint
EXECUTE lahza_featured_requested_at_stmt;--> statement-breakpoint
DEALLOCATE PREPARE lahza_featured_requested_at_stmt;--> statement-breakpoint
SET @lahza_add_featured_reviewed_at = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'partner_offers' AND COLUMN_NAME = 'featuredReviewedAt') = 0, 'ALTER TABLE `partner_offers` ADD `featuredReviewedAt` timestamp', 'SELECT 1');--> statement-breakpoint
PREPARE lahza_featured_reviewed_at_stmt FROM @lahza_add_featured_reviewed_at;--> statement-breakpoint
EXECUTE lahza_featured_reviewed_at_stmt;--> statement-breakpoint
DEALLOCATE PREPARE lahza_featured_reviewed_at_stmt;--> statement-breakpoint
SET @lahza_add_featured_review_note = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'partner_offers' AND COLUMN_NAME = 'featuredReviewNote') = 0, 'ALTER TABLE `partner_offers` ADD `featuredReviewNote` varchar(300)', 'SELECT 1');--> statement-breakpoint
PREPARE lahza_featured_review_note_stmt FROM @lahza_add_featured_review_note;--> statement-breakpoint
EXECUTE lahza_featured_review_note_stmt;--> statement-breakpoint
DEALLOCATE PREPARE lahza_featured_review_note_stmt;
