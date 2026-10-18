export default defineEventHandler(async (event) => {
  const category = await feedCategory(getRouterParam(event, 'file'), 'en')
  return sendFeed(event, { locale: 'en', category })
})
