export interface ZoomUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  type: number;
  pmi?: string;
  timezone?: string;
  dept?: string;
  created_at: string;
  last_login_time?: string;
  last_client_version?: string;
  vanity_url?: string;
  personal_meeting_url?: string;
  verified?: number;
  pic_url?: string;
  cms_user_id?: string;
  account_id?: string;
  host_key?: string;
  group_ids?: string[];
  im_group_ids?: string[];
}

export interface ZoomMeeting {
  uuid: string;
  id: number;
  host_id: string;
  topic: string;
  type: number;
  start_time: string;
  duration: number;
  timezone: string;
  created_at: string;
  agenda?: string;
  start_url?: string;
  join_url: string;
  password?: string;
  h323_password?: string;
  occurrences?: ZoomMeetingOccurrence[];
  settings?: ZoomMeetingSettings;
}

export interface ZoomMeetingOccurrence {
  occurrence_id: string;
  start_time: string;
  duration: number;
  status: string;
}

export interface ZoomMeetingSettings {
  host_video?: boolean;
  participant_video?: boolean;
  cn_meeting?: boolean;
  in_meeting?: boolean;
  join_before_host?: boolean;
  mute_upon_entry?: boolean;
  watermark?: boolean;
  use_pmi?: boolean;
  approval_type?: number;
  registration_type?: number;
  audio?: string;
  auto_recording?: string;
  enforce_login?: boolean;
  enforce_login_domains?: string;
  alternative_hosts?: string;
}

export interface ZoomWebinar {
  uuid: string;
  id: number;
  host_id: string;
  topic: string;
  type: number;
  start_time: string;
  duration: number;
  timezone: string;
  created_at: string;
  agenda?: string;
  start_url?: string;
  join_url: string;
  password?: string;
  occurrences?: ZoomMeetingOccurrence[];
  settings?: ZoomWebinarSettings;
}

export interface ZoomWebinarSettings {
  host_video?: boolean;
  panelists_video?: boolean;
  practice_session?: boolean;
  hd_video?: boolean;
  approval_type?: number;
  registration_type?: number;
  audio?: string;
  auto_recording?: string;
  enforce_login?: boolean;
  enforce_login_domains?: string;
  alternative_hosts?: string;
  close_registration?: boolean;
  show_share_button?: boolean;
  allow_multiple_devices?: boolean;
}

export interface ZoomRecordingFile {
  id: string;
  meeting_id: string;
  recording_start: string;
  recording_end: string;
  file_type: string;
  file_size: number;
  play_url: string;
  download_url: string;
  status: string;
  deleted_time?: string;
  recording_type: string;
}

export interface ZoomRecordingMeeting {
  uuid: string;
  id: number;
  account_id: string;
  host_id: string;
  topic: string;
  start_time: string;
  duration: number;
  total_size: number;
  recording_count: number;
  recording_files: ZoomRecordingFile[];
}

export interface ZoomPaginatedResponse<T> {
  page_count?: number;
  page_number?: number;
  page_size: number;
  total_records: number;
  next_page_token?: string;
  [key: string]: unknown;
  // The actual data array varies by endpoint
}

export interface ZoomRegistrant {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  address?: string;
  city?: string;
  country?: string;
  zip?: string;
  state?: string;
  phone?: string;
  industry?: string;
  org?: string;
  job_title?: string;
  purchasing_time_frame?: string;
  role_in_purchase_process?: string;
  no_of_employees?: string;
  comments?: string;
  status: string;
  create_time: string;
  join_url?: string;
}

export interface ZoomPastMeeting {
  uuid: string;
  id: number;
  host_id: string;
  type: number;
  topic: string;
  user_name: string;
  user_email: string;
  start_time: string;
  end_time: string;
  duration: number;
  total_minutes: number;
  participants_count: number;
}

export interface ZoomPastMeetingParticipant {
  id?: string;
  user_id?: string;
  name: string;
  user_email?: string;
  join_time: string;
  leave_time: string;
  duration: number;
}
