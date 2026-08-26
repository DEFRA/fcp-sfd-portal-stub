export function initDocumentUpload () {
  const uploadForm = document.getElementById('document-upload-form')

  if (!uploadForm) {
    return
  }

  // Keep the filesInSubmission count in sync with the number of files the user has
  // selected, so multi-file submissions are reported accurately to the uploader.
  // This applies regardless of upload mode, as the field is submitted as part of the form.
  const fileInput = document.getElementById('file-upload')
  const filesInSubmissionInput = document.getElementById('files-in-submission')

  if (fileInput && filesInSubmissionInput) {
    fileInput.addEventListener('change', () => {
      filesInSubmissionInput.value = fileInput.files.length
    })
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
        redirect: uploadMode === 'direct' ? 'manual' : 'follow'
      })

      if (uploadMode === 'direct') {
        // In direct mode, CDP Uploader responds with 302 redirect
        if (response.type === 'opaqueredirect' || response.status === 302 || response.status === 0) {
          globalThis.location.href = '/document-upload/processing'
        } else if (response.ok) {
          globalThis.location.href = '/document-upload/processing'
        } else {
          const text = await response.text()
          console.error('Upload failed', response.status, text)
        }
      } else {
        // In gateway-routing/frontend-redirect modes, follow the redirect
        if (response.redirected) {
          globalThis.location.href = response.url
        } else if (response.ok) {
          globalThis.location.href = '/document-upload/processing'
        } else {
          const text = await response.text()
          console.error('Upload failed', response.status, text)
        }
      }
    } catch (error) {
      console.error('Network or CORS error', error)
    }
  })
}
