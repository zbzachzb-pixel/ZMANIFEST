// src/components/ImportStudentsModal.tsx
'use client'

import React, { useState } from 'react'
import { useAddToQueue } from '@/hooks/useDatabase'
import type { CreateQueueStudent } from '@/types'

interface ImportStudentsModalProps {
  onClose: () => void
}

export function ImportStudentsModal({ onClose }: ImportStudentsModalProps) {
  const { add } = useAddToQueue()
  const [importText, setImportText] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [preview, setPreview] = useState<CreateQueueStudent[]>([])

  const parseStudentLine = (line: string, lineNumber: number): CreateQueueStudent | string => {
    const parts = line.split(':').map(p => p.trim())
    
    // Format: Name:Weight:JumpType:Param1:Param2:Param3:Request
    if (parts.length < 4) {
      return `Line ${lineNumber}: Invalid format - need at least Name:Weight:JumpType:Request`
    }

    const name = parts[0]
    const weight = parseFloat(parts[1])
    const jumpType = parts[2].toLowerCase()
    
    if (!name) {
      return `Line ${lineNumber}: Missing student name`
    }
    
    if (isNaN(weight) || weight < 100 || weight > 400) {
      return `Line ${lineNumber}: Invalid weight (must be 100-400)`
    }

    // TANDEM FORMAT: Name:Weight:tandem:Tax:Handcam:OutsideVideo:Request
    // Example: John Doe:180:tandem:1:true:false:false
    if (jumpType === 'tandem') {
      const tax = parseInt(parts[3] || '0')
      const handcam = parts[4]?.toLowerCase() === 'true' || parts[4] === '1'
      const outsideVideo = parts[5]?.toLowerCase() === 'true' || parts[5] === '1'
      const isRequest = parts[6]?.toLowerCase() === 'true' || parts[6] === '1'

      if (isNaN(tax) || tax < 0 || tax > 5) {
        return `Line ${lineNumber}: Invalid tax (must be 0-5)`
      }

      return {
        name,
        weight,
        jumpType: 'tandem',
        tandemWeightTax: tax,
        tandemHandcam: handcam,
        outsideVideo: outsideVideo,
        isRequest: isRequest
      }
    }
    
    // AFF FORMAT: Name:Weight:aff:Level:Request
    // Example: Jane Smith:150:aff:lower:false
    else if (jumpType === 'aff') {
      const affLevel = parts[3]?.toLowerCase() === 'upper' ? 'upper' : 'lower'
      const isRequest = parts[4]?.toLowerCase() === 'true' || parts[4] === '1'

      return {
        name,
        weight,
        jumpType: 'aff',
        affLevel: affLevel,
        isRequest: isRequest
      }
    }
    
    else {
      return `Line ${lineNumber}: Invalid jump type (must be 'tandem' or 'aff')`
    }
  }

  const handlePreview = () => {
    const lines = importText.split('\n').filter(line => line.trim() && !line.startsWith('#'))
    const newErrors: string[] = []
    const students: CreateQueueStudent[] = []

    lines.forEach((line, index) => {
      const result = parseStudentLine(line, index + 1)
      if (typeof result === 'string') {
        newErrors.push(result)
      } else {
        students.push(result)
      }
    })

    setErrors(newErrors)
    setPreview(students)
  }

  const handleImport = async () => {
    if (preview.length === 0) {
      alert('No students to import. Click "Preview" first.')
      return
    }

    if (errors.length > 0) {
      if (!confirm(`There are ${errors.length} errors. Import ${preview.length} valid students anyway?`)) {
        return
      }
    }

    setLoading(true)
    
    try {
      let successCount = 0
      let failCount = 0

      for (const student of preview) {
        try {
          await add(student)
          successCount++
        } catch (error) {
          console.error(`Failed to add ${student.name}:`, error)
          failCount++
        }
      }

      alert(`✅ Import complete!\n\nSuccess: ${successCount}\nFailed: ${failCount}`)
      
      if (failCount === 0) {
        onClose()
      }
    } catch (error) {
      console.error('Import failed:', error)
      alert('Import failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      setImportText(text)
    }
    reader.readAsText(file)
  }

  const exampleText = `# TANDEM FORMAT: Name:Weight:tandem:Tax:Handcam:OutsideVideo:Request
John Doe:180:tandem:0:false:false:false
Jane Smith:200:tandem:1:true:false:false
Mike Johnson:220:tandem:2:true:true:false
Sarah Williams:165:tandem:0:true:false:true

# AFF FORMAT: Name:Weight:aff:Level:Request
Bob Anderson:175:aff:lower:false
Alice Cooper:160:aff:upper:false
Tom Brady:190:aff:lower:true

# You can use comments starting with #
# Tax: 0-5 (weight increments over limit)
# Handcam: true/false or 1/0
# OutsideVideo: true/false or 1/0
# Request: true/false or 1/0
# AFF Level: lower or upper`

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-slate-700">
        <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-6 z-10">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-white">📥 Import Students</h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white text-xl"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Format Guide */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <h3 className="text-blue-300 font-bold mb-2">📋 Format Guide</h3>
            <div className="text-sm text-slate-300 space-y-2">
              <div>
                <span className="font-semibold text-white">Tandem:</span>{' '}
                <code className="bg-slate-700 px-2 py-1 rounded">
                  Name:Weight:tandem:Tax:Handcam:OutsideVideo:Request
                </code>
              </div>
              <div>
                <span className="font-semibold text-white">AFF:</span>{' '}
                <code className="bg-slate-700 px-2 py-1 rounded">
                  Name:Weight:aff:Level:Request
                </code>
              </div>
              <div className="mt-2 text-xs text-slate-400">
                • One student per line<br />
                • Lines starting with # are comments (ignored)<br />
                • Tax: 0-5, Handcam/OutsideVideo/Request: true/false or 1/0<br />
                • AFF Level: lower or upper
              </div>
            </div>
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Upload .txt File
            </label>
            <input
              type="file"
              accept=".txt"
              onChange={handleFileUpload}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-blue-500 file:text-white hover:file:bg-blue-600"
            />
          </div>

          {/* Text Input */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Or Paste/Type Data
            </label>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={exampleText}
              className="w-full h-64 px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          {/* Preview Button */}
          <div className="flex gap-3">
            <button
              onClick={handlePreview}
              disabled={!importText.trim()}
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              🔍 Preview Import
            </button>
            <button
              onClick={() => setImportText(exampleText)}
              className="bg-slate-600 hover:bg-slate-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              Load Example
            </button>
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <h3 className="text-red-300 font-bold mb-2">⚠️ Errors ({errors.length})</h3>
              <div className="text-sm text-red-300 space-y-1 max-h-32 overflow-y-auto">
                {errors.map((error, index) => (
                  <div key={index}>• {error}</div>
                ))}
              </div>
            </div>
          )}

          {/* Preview */}
          {preview.length > 0 && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
              <h3 className="text-green-300 font-bold mb-2">
                ✅ Preview ({preview.length} students)
              </h3>
              <div className="text-sm text-slate-300 space-y-1 max-h-48 overflow-y-auto">
                {preview.map((student, index) => (
                  <div key={index} className="bg-slate-700/50 rounded px-3 py-2">
                    <span className="font-semibold text-white">{student.name}</span>
                    {' • '}
                    <span>{student.weight} lbs</span>
                    {' • '}
                    <span className="uppercase">{student.jumpType}</span>
                    {student.jumpType === 'tandem' && (
                      <>
                        {student.tandemWeightTax ? ` • Tax: ${student.tandemWeightTax}` : ''}
                        {student.tandemHandcam && ' • 📹 Handcam'}
                        {student.outsideVideo && ' • 🎥 Outside Video'}
                      </>
                    )}
                    {student.jumpType === 'aff' && (
                      <span> • Level: {student.affLevel}</span>
                    )}
                    {student.isRequest && (
                      <span className="ml-2 text-yellow-400">⭐ REQUEST</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="border-t border-slate-700 p-6 flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 bg-slate-600 hover:bg-slate-700 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={loading || preview.length === 0}
            className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '⏳ Importing...' : `✓ Import ${preview.length} Students`}
          </button>
        </div>
      </div>
    </div>
  )
}