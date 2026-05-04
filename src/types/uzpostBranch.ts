export interface UzpostBranch {
  id: number;
  name: string;
  index: number;
  address: string;
  longitude: number;
  latitude: number;
  workdays: string | null;
  lunch: string | null;
  saturday: string | null;
  dayOff: string | null;
  otherScheduleNotes: string | null;
}

export interface UzpostBranchSubmission {
  id: number;
  name: string;
  index: number;
  address: string;
  longitude: number;
  latitude: number;
  workdays: string | null;
  lunch: string | null;
  saturday: string | null;
  day_off: string | null;
  other_schedule_notes: string | null;
}

export function toUzpostBranchSubmission(branch: UzpostBranch): UzpostBranchSubmission {
  return {
    id: branch.id,
    name: branch.name,
    index: branch.index,
    address: branch.address,
    longitude: branch.longitude,
    latitude: branch.latitude,
    workdays: branch.workdays,
    lunch: branch.lunch,
    saturday: branch.saturday,
    day_off: branch.dayOff,
    other_schedule_notes: branch.otherScheduleNotes,
  };
}
