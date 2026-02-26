export function initDocumentUpload () {
  const uploadForm = document.getElementById('document-upload-form')

  if (!uploadForm) {
    return
  }

  uploadForm.addEventListener('submit', async (e) => {
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
        window.location.href = '/document-upload/processing'
      } else if (response.ok) {
        // Successful response without redirect
        const body = await response.json()
        console.log('Upload response', body)
        window.location.href = '/document-upload/processing'
      } else {
        const text = await response.text()
        console.error('Upload failed', response.status, text)
      }
    } catch (error) {
      console.error('Network or CORS error', error)
    }
  })
}
