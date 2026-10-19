<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class SubscriptionReminderMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $shopName,
        public int $daysRemaining,
        public bool $isTrial,
        public string $subscriptionUrl,
    ) {}

    public function envelope(): Envelope
    {
        $subject = $this->isTrial
            ? "Votre essai gratuit Stoq.bj se termine dans {$this->daysRemaining} jour(s)"
            : "Votre abonnement Stoq.bj expire dans {$this->daysRemaining} jour(s)";

        return new Envelope(subject: $subject);
    }

    public function content(): Content
    {
        return new Content(view: 'emails.subscription-reminder');
    }
}
