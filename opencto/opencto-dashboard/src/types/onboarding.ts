export type TeamSizeBand = '1' | '2-5' | '6-20' | '21-50' | '51+'

export interface OnboardingState {
  completed: boolean
  profile: {
    firstName: string
    lastName: string
    email: string
    phone: string
    githubUsername: string
  }
  companyName: string
  teamSize: TeamSizeBand | ''
  termsAccepted: boolean
}

export interface SaveOnboardingInput {
  firstName: string
  lastName: string
  email: string
  phone: string
  githubUsername: string
  companyName: string
  teamSize: TeamSizeBand
  acceptTerms: boolean
}
