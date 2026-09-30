-- Múltiplos vendedores por usuário — Release 1 (aditiva).
-- Cria o vínculo N:N User <-> Seller e copia os vínculos atuais dos usuários
-- SELLER. `User.sellerId` NÃO é alterado nem removido aqui: passa a ser só um
-- espelho de compatibilidade (rollback) e será removido na Release 2.

-- CreateTable
CREATE TABLE `UserSeller` (
    `userId` VARCHAR(191) NOT NULL,
    `sellerId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `UserSeller_sellerId_idx`(`sellerId`),
    PRIMARY KEY (`userId`, `sellerId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `UserSeller` ADD CONSTRAINT `UserSeller_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserSeller` ADD CONSTRAINT `UserSeller_sellerId_fkey` FOREIGN KEY (`sellerId`) REFERENCES `Seller`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: somente usuários com perfil SELLER e vendedor vinculado. Vínculos
-- legados de usuários NÃO-SELLER não são migrados (a aplicação já os ignora).
INSERT INTO `UserSeller` (`userId`, `sellerId`)
SELECT `id`, `sellerId`
FROM `User`
WHERE `role` = 'SELLER' AND `sellerId` IS NOT NULL;
