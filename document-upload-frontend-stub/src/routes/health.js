export const healthGet = {
  method: 'GET',
  path: '/health',
  handler: () => {
    return { message: 'success' }
  }
}
