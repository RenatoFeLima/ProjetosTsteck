-- Lembretes operacionais por projeto (follow-ups com alerta recorrente).
-- Soft delete: remover = status CANCELADO (mantém histórico para auditoria).

-- CreateTable
CREATE TABLE `ProjectReminder` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `priority` ENUM('NORMAL', 'ALTA') NOT NULL DEFAULT 'NORMAL',
    `status` ENUM('PENDENTE', 'RESOLVIDO', 'CANCELADO') NOT NULL DEFAULT 'PENDENTE',
    `startDate` DATETIME(3) NOT NULL,
    `nextAlertDate` DATETIME(3) NOT NULL,
    `recurrenceDays` INTEGER NOT NULL,
    `createdById` VARCHAR(191) NULL,
    `createdByName` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `resolvedById` VARCHAR(191) NULL,
    `resolvedByName` VARCHAR(191) NULL,
    `resolvedAt` DATETIME(3) NULL,
    `canceledById` VARCHAR(191) NULL,
    `canceledByName` VARCHAR(191) NULL,
    `canceledAt` DATETIME(3) NULL,
    `lastPostponedById` VARCHAR(191) NULL,
    `lastPostponedByName` VARCHAR(191) NULL,
    `lastPostponedAt` DATETIME(3) NULL,

    INDEX `ProjectReminder_projectId_idx`(`projectId`),
    INDEX `ProjectReminder_status_idx`(`status`),
    INDEX `ProjectReminder_nextAlertDate_idx`(`nextAlertDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProjectReminderLog` (
    `id` VARCHAR(191) NOT NULL,
    `reminderId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `actorUserId` VARCHAR(191) NULL,
    `actorName` VARCHAR(191) NOT NULL,
    `oldValue` TEXT NULL,
    `newValue` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ProjectReminderLog_reminderId_idx`(`reminderId`),
    INDEX `ProjectReminderLog_projectId_idx`(`projectId`),
    INDEX `ProjectReminderLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ProjectReminder` ADD CONSTRAINT `ProjectReminder_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectReminderLog` ADD CONSTRAINT `ProjectReminderLog_reminderId_fkey` FOREIGN KEY (`reminderId`) REFERENCES `ProjectReminder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
