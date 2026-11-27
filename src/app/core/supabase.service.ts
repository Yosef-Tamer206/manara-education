import { Injectable } from '@angular/core';
import { createClient } from '@supabase/supabase-js';
import { SB_KEY, SB_URL } from './constants';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly client = createClient(SB_URL, SB_KEY);
}
