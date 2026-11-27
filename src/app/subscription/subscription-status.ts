import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { arDate } from '../core/format';
import { SubscriptionService } from './subscription.service';

/** Where the student stands: monthly access, single lessons, anything waiting for the teacher, expiry reminder. */
@Component({
  selector: 'app-subscription-status',
  imports: [RouterLink],
  templateUrl: './subscription-status.html',
})
export class SubscriptionStatus implements OnInit {
  protected subs = inject(SubscriptionService);
  protected arDate = arDate;

  ngOnInit() {
    return this.subs.refresh();
  }
}
