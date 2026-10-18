export default defineEventHandler(async (event) => {
  const category = await feedCategory(getRouterParam(event, 'file'), 'es')
  return sendFeed(event, { locale: 'es', category })
})
