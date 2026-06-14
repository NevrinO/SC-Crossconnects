import { Room } from '../types/editor'
import { validateRoom, ValidationError } from '../lib/validation'

interface ValidationSummaryPanelProps {
  room: Room
}

export function ValidationSummaryPanel({ room }: ValidationSummaryPanelProps) {
  const validationResult = validateRoom(room)
  const errors = validationResult.errors.filter(e => e.severity === 'error')
  const warnings = validationResult.errors.filter(e => e.severity === 'warning')

  // Group errors by field
  const errorsByField = errors.reduce((acc, error) => {
    if (!acc[error.field]) {
      acc[error.field] = []
    }
    acc[error.field].push(error)
    return acc
  }, {} as Record<string, ValidationError[]>)

  const warningsByField = warnings.reduce((acc, warning) => {
    if (!acc[warning.field]) {
      acc[warning.field] = []
    }
    acc[warning.field].push(warning)
    return acc
  }, {} as Record<string, ValidationError[]>)

  if (validationResult.isValid && warnings.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-green-900">Room is valid</h3>
            <p className="text-sm text-green-700">No validation issues found</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Validation Summary</h2>
        <div className="flex items-center gap-2">
          {errors.length > 0 && (
            <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
              {errors.length} {errors.length === 1 ? 'Error' : 'Errors'}
            </span>
          )}
          {warnings.length > 0 && (
            <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">
              {warnings.length} {warnings.length === 1 ? 'Warning' : 'Warnings'}
            </span>
          )}
        </div>
      </div>

      {Object.keys(errorsByField).length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-red-900 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            Errors
          </h3>
          <div className="space-y-3">
            {Object.entries(errorsByField).map(([field, fieldErrors]) => (
              <div key={field} className="bg-red-50 border border-red-200 rounded-md p-3">
                <h4 className="text-sm font-medium text-red-900 mb-2">{field}</h4>
                <ul className="space-y-1">
                  {fieldErrors.map((error, idx) => (
                    <li key={idx} className="text-sm text-red-700">• {error.message}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {Object.keys(warningsByField).length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-yellow-900 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Warnings
          </h3>
          <div className="space-y-3">
            {Object.entries(warningsByField).map(([field, fieldWarnings]) => (
              <div key={field} className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                <h4 className="text-sm font-medium text-yellow-900 mb-2">{field}</h4>
                <ul className="space-y-1">
                  {fieldWarnings.map((warning, idx) => (
                    <li key={idx} className="text-sm text-yellow-700">• {warning.message}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
