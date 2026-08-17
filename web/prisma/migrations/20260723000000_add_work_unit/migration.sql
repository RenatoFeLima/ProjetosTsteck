-- AlterTable
ALTER TABLE `Project` ADD COLUMN `workUnitId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `WorkUnit` (
    `id` VARCHAR(191) NOT NULL,
    `workId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `WorkUnit_workId_idx`(`workId`),
    INDEX `WorkUnit_active_idx`(`active`),
    UNIQUE INDEX `WorkUnit_workId_name_key`(`workId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Project_workUnitId_idx` ON `Project`(`workUnitId`);

-- AddForeignKey
ALTER TABLE `WorkUnit` ADD CONSTRAINT `WorkUnit_workId_fkey` FOREIGN KEY (`workId`) REFERENCES `Work`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Project` ADD CONSTRAINT `Project_workUnitId_fkey` FOREIGN KEY (`workUnitId`) REFERENCES `WorkUnit`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
