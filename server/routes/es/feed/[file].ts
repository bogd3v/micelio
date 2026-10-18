export default defineEventHandler(async (event) => {
  assertBlogEnabled(event)
  const category = await feedCategory(getRouterParam(event, 'file'), 'es')
  return sendFeed(event, { locale: 'es', category })
})
