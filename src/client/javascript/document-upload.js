export function initDocumentUpload () {
  const uploadForm = document.getElementById('document-upload-form')

  if (!uploadForm) {
    return
  }

  // Only intercept form submission in 'direct' mode
  // In 'gateway-routing' mode, standard form POST works
  const uploadMode = uploadForm.getAttribute('data-upload-mode')

  if (uploadMode !== 'direct') {
    // Let the browser handle form submission normally
    return
  }

  uploadForm.addEventListener('submit', async (e) => {
    // Prevent the default form submission to handle it via JavaScript
    // This is because the /upload-and-scan endpoint performs a relative redirect
    // This means that a normal form submission would be incorrectly redirected to a path assumed to be within the CDP Uploader domain
    // instead of the clients.
    // CDP have plans to change this to an absolute redirect in the future
    // For now, there is no way to avoid the need for client side JavaScript if Gateway level routing cannot be used on the client's domain.

    e.preventDefault()

    const form = e.target
    const formData = new FormData(form)
    const uploadUrl = form.action

    try {
      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
        redirect: 'manual'
      })

      // CDP Uploader may respond with 302 redirect when upload is accepted
      if (response.type === 'opaqueredirect' || response.status === 302 || response.status === 0) {
        // Upload accepted; scanning in progress
        globalThis.location.href = '/document-upload/processing'
      } else if (response.ok) {
        // Successful response without redirect
        const body = await response.json()
        console.log('Upload response', body)
        globalThis.location.href = '/document-upload/processing'
      } else {
        const text = await response.text()
        console.error('Upload failed', response.status, text)
      }
    } catch (error) {
      console.error('Network or CORS error', error)
    }
  })
}
