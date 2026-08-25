CREATE TABLE `support_contacts` (
  `id` int AUTO_INCREMENT NOT NULL,
  `label` varchar(80) NOT NULL,
  `phone` varchar(24) NOT NULL,
  `callEnabled` boolean NOT NULL DEFAULT true,
  `whatsappEnabled` boolean NOT NULL DEFAULT true,
  `active` boolean NOT NULL DEFAULT true,
  `sortOrder` int NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `support_contacts_id` PRIMARY KEY(`id`)
);
