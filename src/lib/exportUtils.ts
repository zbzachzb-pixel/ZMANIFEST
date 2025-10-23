// src/lib/exportUtils.ts
// Utilities for exporting data to CSV format

import type { Instructor, InstructorStats, PeriodStats } from '@/types'

/**
 * Convert data array to CSV string
 */
function arrayToCSV(headers: string[], rows: string[][]): string {
  const escapeCsvValue = (value: string) => {
    // Escape quotes and wrap in quotes if contains comma, quote, or newline
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`
    }
    return value
  }

  const headerRow = headers.map(escapeCsvValue).join(',')
  const dataRows = rows.map(row => row.map(escapeCsvValue).join(',')).join('\n')

  return `${headerRow}\n${dataRows}`
}

/**
 * Download CSV file
 */
function downloadCSV(filename: string, csvContent: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * Export instructor stats to CSV
 */
export function exportInstructorStatsToCSV(
  instructors: Instructor[],
  stats: Map<string, InstructorStats>,
  periodName: string = 'Current Period'
) {
  const headers = [
    'Instructor Name',
    'Team',
    'Total Jumps',
    'Tandem Jumps',
    'AFF Jumps',
    'Video Jumps',
    'Missed Jumps',
    'Balance',
    'Total Earnings',
    'Avg Per Jump'
  ]

  const rows = instructors.map(instructor => {
    const instructorStats = stats.get(instructor.id) || {
      totalJumps: 0,
      tandemCount: 0,
      affCount: 0,
      videoCount: 0,
      missedJumps: 0,
      balanceEarnings: 0,
      totalEarnings: 0,
      avgPerJump: 0
    }

    return [
      instructor.name,
      instructor.team || 'N/A',
      instructorStats.totalJumps.toString(),
      instructorStats.tandemCount.toString(),
      instructorStats.affCount.toString(),
      instructorStats.videoCount.toString(),
      instructorStats.missedJumps.toString(),
      instructorStats.balanceEarnings.toString(),
      `$${instructorStats.totalEarnings.toFixed(2)}`,
      `$${instructorStats.avgPerJump.toFixed(2)}`
    ]
  })

  const csvContent = arrayToCSV(headers, rows)
  const timestamp = new Date().toISOString().split('T')[0]
  const filename = `instructor-stats-${periodName.replace(/\s+/g, '-')}-${timestamp}.csv`

  downloadCSV(filename, csvContent)
}

/**
 * Export period summary to CSV
 */
export function exportPeriodSummaryToCSV(
  periodStats: PeriodStats,
  periodName: string = 'Period Summary'
) {
  const headers = ['Metric', 'Value']

  const rows = [
    ['Total Jumps', periodStats.totalJumps.toString()],
    ['Tandem Jumps', periodStats.tandemCount.toString()],
    ['AFF Jumps', periodStats.affCount.toString()],
    ['Video Jumps', periodStats.videoCount.toString()],
    ['Missed Jumps', periodStats.missedJumps.toString()],
    ['Total Earnings', `$${periodStats.totalEarnings.toFixed(2)}`],
    ['Instructor Count', periodStats.instructorCount.toString()],
    ['Average Per Jump', `$${periodStats.avgPerJump.toFixed(2)}`]
  ]

  const csvContent = arrayToCSV(headers, rows)
  const timestamp = new Date().toISOString().split('T')[0]
  const filename = `period-summary-${periodName.replace(/\s+/g, '-')}-${timestamp}.csv`

  downloadCSV(filename, csvContent)
}

/**
 * Export detailed instructor report to CSV
 */
export function exportDetailedInstructorReportToCSV(
  instructor: Instructor,
  assignments: any[] // Assignment history
) {
  const headers = [
    'Date',
    'Student Name',
    'Jump Type',
    'Weight',
    'Was Request',
    'Had Outside Video',
    'Earnings'
  ]

  const rows = assignments.map(assignment => [
    new Date(assignment.timestamp || assignment.createdAt).toLocaleDateString(),
    assignment.studentName,
    assignment.jumpType.toUpperCase(),
    assignment.studentWeight.toString(),
    assignment.isRequest ? 'Yes' : 'No',
    assignment.hasOutsideVideo ? 'Yes' : 'No',
    `$${assignment.earnings?.toFixed(2) || '0.00'}`
  ])

  const csvContent = arrayToCSV(headers, rows)
  const timestamp = new Date().toISOString().split('T')[0]
  const filename = `${instructor.name.replace(/\s+/g, '-')}-detailed-report-${timestamp}.csv`

  downloadCSV(filename, csvContent)
}

/**
 * Export leaderboard data to CSV
 */
export function exportLeaderboardToCSV(
  leaderboardData: Array<{ name: string; value: number; label?: string }>,
  leaderboardName: string,
  valueLabel: string = 'Value'
) {
  const headers = ['Rank', 'Instructor Name', valueLabel]

  const rows = leaderboardData.map((item, index) => [
    (index + 1).toString(),
    item.name,
    item.label || item.value.toString()
  ])

  const csvContent = arrayToCSV(headers, rows)
  const timestamp = new Date().toISOString().split('T')[0]
  const filename = `${leaderboardName.replace(/\s+/g, '-')}-${timestamp}.csv`

  downloadCSV(filename, csvContent)
}
