-- AddColumn: prazo absoluto para Projeto (importação Ante-Projeto CSV)
ALTER TABLE `Project` ADD COLUMN `deadline` DATETIME(3) NULL;
CREATE INDEX `Project_deadline_idx` ON `Project`(`deadline`);
