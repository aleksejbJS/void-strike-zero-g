// The one password rule, in its own tiny module so the UI can show it without loading the account backend.

/** Supabase's default minimum; a shorter password would only come back as a server rejection. */
export const PASSWORD_MIN = 6;
