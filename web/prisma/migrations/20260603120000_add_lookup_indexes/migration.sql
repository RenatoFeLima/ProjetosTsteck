-- CreateIndex
CREATE INDEX `CabinType_name_idx` ON `CabinType`(`name`);

-- CreateIndex
CREATE INDEX `Constructor_name_idx` ON `Constructor`(`name`);

-- CreateIndex
CREATE INDEX `Engineer_name_idx` ON `Engineer`(`name`);

-- CreateIndex
CREATE INDEX `Seller_name_idx` ON `Seller`(`name`);

-- CreateIndex
CREATE INDEX `Seller_email_idx` ON `Seller`(`email`);

-- CreateIndex
CREATE INDEX `Work_constructorId_name_idx` ON `Work`(`constructorId`, `name`);

-- CreateIndex
CREATE INDEX `Project_equipmentId_idx` ON `Project`(`equipmentId`);

