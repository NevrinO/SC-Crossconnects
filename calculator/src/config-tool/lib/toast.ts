import toast from 'react-hot-toast'

export const showSuccess = (message: string) => {
  return toast.success(message)
}

export const showError = (message: string) => {
  return toast.error(message)
}

export const showInfo = (message: string) => {
  return toast(message, {
    icon: 'ℹ️',
  })
}
