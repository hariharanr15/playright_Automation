const { Then, When } = require('@cucumber/cucumber');
const { CommonUomPage } = require('../../pages/project-management/common-uom.page');
const { MaterialCategoryPage } = require('../../pages/project-management/material-category.page');

When('the user opens Common UoM from Reference Data', async function () {
  this.commonUom = new CommonUomPage(this.page);
  await this.commonUom.open(this.dashboard);
});

When('the user creates and updates a unique common UoM', async function () {
  const original = `Dozen ${this.runData.nextSequence()}`;
  const updated = `${original}.`;
  await this.commonUom.add(original);
  await this.commonUom.update(original, updated);
  this.runData.updatedUomName = updated;
  this.runData.captureData('commonUom', updated, 'Reference Data > Common UoM');
});

Then('the updated common UoM is displayed in search results', async function () {
  await this.commonUom.expectUom(this.runData.updatedUomName);
  await this.captureCheckpoint('TC_PM_UOM_001_Common_UOM_Updated');
  await this.commonUom.clearSearch();
});

When('the user opens Material Category from Reference Data', async function () {
  this.materialCategory = new MaterialCategoryPage(this.page);
  await this.materialCategory.open(this.dashboard);
});

When('the user creates and updates a unique material category', async function () {
  const original = `Wooden Furniture ${this.runData.nextSequence()}`;
  const updated = `${original}.`;
  await this.materialCategory.add(original);
  await this.materialCategory.update(original, updated);
  this.runData.updatedMaterialCategoryName = updated;
  this.runData.captureData('materialCategory', updated, 'Reference Data > Material Category');
});

Then('the updated material category is displayed in search results', async function () {
  await this.materialCategory.expectCategory(this.runData.updatedMaterialCategoryName);
  await this.captureCheckpoint('TC_PM_MC_001_Material_Category_Updated');
  await this.materialCategory.clearSearch();
});
