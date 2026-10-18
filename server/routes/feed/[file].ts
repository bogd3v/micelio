export default defineEventHandler(async (event) => {
  assertBlogEnabled(event)
  const category = await feedCategory(getRouterParam(event, 'file'), 'en')
  return sendFeed(event, { locale: 'en', category })
})
