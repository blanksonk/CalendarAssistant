/** Realistic mock calendar events for the week of Apr 6–12, 2026 */

function dt(day: number, hour: number, minute = 0) {
  return new Date(2026, 3, day, hour, minute).toISOString()
}

export const MOCK_USER = {
  id: 'user-mock-123',
  email: 'alex@company.com',
  name: 'Alex Johnson',
  picture: null,
}

export const MOCK_EVENTS = [
  // Monday Apr 6
  {
    id: 'e1',
    summary: 'Daily Standup',
    description: 'Engineering standup — 15 mins',
    start: { dateTime: dt(6, 9, 30) },
    end: { dateTime: dt(6, 9, 45) },
    attendees: [
      { email: 'alex@company.com', self: true },
      { email: 'maria@company.com', displayName: 'Maria' },
      { email: 'james@company.com', displayName: 'James' },
    ],
    organizer: { email: 'alex@company.com', self: true },
  },
  {
    id: 'e2',
    summary: '1:1 with Maria',
    description: 'Weekly check-in',
    start: { dateTime: dt(6, 11, 0) },
    end: { dateTime: dt(6, 12, 0) },
    attendees: [
      { email: 'alex@company.com', self: true },
      { email: 'maria@company.com', displayName: 'Maria' },
    ],
    organizer: { email: 'maria@company.com', self: false },
  },
  {
    id: 'e3',
    summary: 'Product Planning',
    description: 'Q2 roadmap review',
    start: { dateTime: dt(6, 14, 0) },
    end: { dateTime: dt(6, 15, 30) },
    attendees: [
      { email: 'alex@company.com', self: true },
      { email: 'sarah@company.com', displayName: 'Sarah' },
      { email: 'tom@company.com', displayName: 'Tom' },
      { email: 'linda@company.com', displayName: 'Linda' },
    ],
    organizer: { email: 'sarah@company.com', self: false },
  },
  // Tuesday Apr 7
  {
    id: 'e4',
    summary: 'Daily Standup',
    start: { dateTime: dt(7, 9, 30) },
    end: { dateTime: dt(7, 9, 45) },
    attendees: [
      { email: 'alex@company.com', self: true },
      { email: 'maria@company.com', displayName: 'Maria' },
      { email: 'james@company.com', displayName: 'James' },
    ],
    organizer: { email: 'alex@company.com', self: true },
    recurringEventId: 'standup-series',
  },
  {
    id: 'e5',
    summary: 'Investor Call',
    description: 'Series B update',
    start: { dateTime: dt(7, 13, 0) },
    end: { dateTime: dt(7, 14, 0) },
    attendees: [
      { email: 'alex@company.com', self: true },
      { email: 'investor@vc.com', displayName: 'Fund Partner' },
    ],
    organizer: { email: 'investor@vc.com', self: false },
  },
  {
    id: 'e6',
    summary: 'Design Review',
    start: { dateTime: dt(7, 15, 0) },
    end: { dateTime: dt(7, 16, 0) },
    attendees: [
      { email: 'alex@company.com', self: true },
      { email: 'design@company.com', displayName: 'Design' },
      { email: 'pm@company.com', displayName: 'PM' },
      { email: 'eng@company.com', displayName: 'Eng Lead' },
    ],
    organizer: { email: 'alex@company.com', self: true },
  },
  // Wednesday Apr 8
  {
    id: 'e7',
    summary: 'Daily Standup',
    start: { dateTime: dt(8, 9, 30) },
    end: { dateTime: dt(8, 9, 45) },
    attendees: [
      { email: 'alex@company.com', self: true },
      { email: 'maria@company.com', displayName: 'Maria' },
      { email: 'james@company.com', displayName: 'James' },
    ],
    organizer: { email: 'alex@company.com', self: true },
    recurringEventId: 'standup-series',
  },
  {
    id: 'e8',
    summary: '1:1 with James',
    start: { dateTime: dt(8, 10, 0) },
    end: { dateTime: dt(8, 11, 0) },
    attendees: [
      { email: 'alex@company.com', self: true },
      { email: 'james@company.com', displayName: 'James' },
    ],
    organizer: { email: 'alex@company.com', self: true },
  },
  // Thursday Apr 9
  {
    id: 'e9',
    summary: 'Daily Standup',
    start: { dateTime: dt(9, 9, 30) },
    end: { dateTime: dt(9, 9, 45) },
    attendees: [
      { email: 'alex@company.com', self: true },
      { email: 'maria@company.com', displayName: 'Maria' },
      { email: 'james@company.com', displayName: 'James' },
    ],
    organizer: { email: 'alex@company.com', self: true },
    recurringEventId: 'standup-series',
  },
  {
    id: 'e10',
    summary: 'Sprint Planning',
    description: 'Sprint 24 planning — estimate tickets, assign owners',
    start: { dateTime: dt(9, 10, 0) },
    end: { dateTime: dt(9, 12, 0) },
    attendees: [
      { email: 'alex@company.com', self: true },
      { email: 'maria@company.com', displayName: 'Maria' },
      { email: 'james@company.com', displayName: 'James' },
      { email: 'eng@company.com', displayName: 'Eng Lead' },
      { email: 'qa@company.com', displayName: 'QA' },
    ],
    organizer: { email: 'alex@company.com', self: true },
  },
  {
    id: 'e11',
    summary: 'Customer Demo',
    description: 'Acme Corp — new features walkthrough',
    start: { dateTime: dt(9, 15, 0) },
    end: { dateTime: dt(9, 16, 0) },
    attendees: [
      { email: 'alex@company.com', self: true },
      { email: 'customer@acme.com', displayName: 'Acme Lead' },
    ],
    organizer: { email: 'alex@company.com', self: true },
  },
  // Friday Apr 10
  {
    id: 'e12',
    summary: 'Daily Standup',
    start: { dateTime: dt(10, 9, 30) },
    end: { dateTime: dt(10, 9, 45) },
    attendees: [
      { email: 'alex@company.com', self: true },
      { email: 'maria@company.com', displayName: 'Maria' },
      { email: 'james@company.com', displayName: 'James' },
    ],
    organizer: { email: 'alex@company.com', self: true },
    recurringEventId: 'standup-series',
  },
  {
    id: 'e13',
    summary: 'Retro',
    description: 'Sprint 23 retrospective',
    start: { dateTime: dt(10, 14, 0) },
    end: { dateTime: dt(10, 15, 0) },
    attendees: [
      { email: 'alex@company.com', self: true },
      { email: 'maria@company.com', displayName: 'Maria' },
      { email: 'james@company.com', displayName: 'James' },
      { email: 'eng@company.com', displayName: 'Eng Lead' },
    ],
    organizer: { email: 'alex@company.com', self: true },
  },
]
