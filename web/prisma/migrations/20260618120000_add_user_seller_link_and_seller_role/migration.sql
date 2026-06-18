-- Acesso comercial: novo role SELLER e vínculo opcional User -> Seller.

-- 1) Adiciona o valor SELLER ao enum de role do User (MySQL: redefinição da coluna ENUM).
ALTER TABLE `User`
  MODIFY `role` ENUM('ADMIN', 'MANAGER', 'PROJECTS', 'COMMERCIAL', 'SELLER', 'VIEWER', 'CUSTOM') NOT NULL DEFAULT 'VIEWER';

-- 2) Vínculo opcional com o cadastro de Vendedor (usado quando role = SELLER).
ALTER TABLE `User` ADD COLUMN `sellerId` VARCHAR(191) NULL;

-- 3) Índice e FK (SET NULL ao remover o vendedor — não apaga o usuário).
CREATE INDEX `User_sellerId_idx` ON `User`(`sellerId`);

ALTER TABLE `User`
  ADD CONSTRAINT `User_sellerId_fkey`
  FOREIGN KEY (`sellerId`) REFERENCES `Seller`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
