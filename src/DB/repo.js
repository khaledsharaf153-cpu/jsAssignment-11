export async function findOneDoc({ model, filter, projection }) {
  return await model.findOne(filter, projection);
}

export async function findDocById({ model, id, projection }) {
  return await model.findById(id, projection);
}

export async function createDoc({ model, data, options }) {
  return await model.create([data], options);
}
