<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Ticket {{ $sale->invoice_number }}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Courier New', Courier, monospace;
            font-size: 11px; color: #1a1a1a;
            background: #fff; width: 72mm; padding: 4mm;
        }
        .center { text-align: center; }
        .right   { text-align: right; }
        .bold    { font-weight: bold; }
        .separator     { border-top: 1px dashed #1a1a1a; margin: 5px 0; }
        .double-sep    { border-top: 2px solid #1a1a1a; margin: 5px 0; }
        .orange-sep    { border-top: 2px solid #F97316; margin: 5px 0; }

        .shop-name  { font-size: 14px; font-weight: bold; text-align: center; color: #F97316; margin-bottom: 2px; }
        .shop-info  { text-align: center; font-size: 10px; line-height: 1.5; margin-bottom: 4px; }
        .invoice-header { text-align: center; font-size: 12px; font-weight: bold; margin: 4px 0; color: #1a1a1a; }

        table { width: 100%; border-collapse: collapse; }
        .items-header td { font-weight: bold; font-size: 10px; border-bottom: 1px solid #F97316; padding: 2px 0; color: #EA580C; }
        .item-row td   { padding: 2px 0; font-size: 10px; vertical-align: top; }
        .item-name  { width: 55%; }
        .item-qty   { width: 10%; text-align: center; }
        .item-price { width: 15%; text-align: right; }
        .item-total { width: 20%; text-align: right; }

        .totals td { padding: 2px 0; font-size: 11px; }
        .totals td:last-child { text-align: right; }
        .total-final td { font-size: 13px; font-weight: bold; padding: 3px 0; }
        .total-final td:last-child { text-align: right; color: #F97316; }

        .footer-msg { text-align: center; font-size: 10px; margin-top: 6px; line-height: 1.6; }
        .barcode-zone { text-align: center; margin: 6px 0; font-size: 9px; letter-spacing: 3px; color: #555; }
        .stockone-badge { color: #F97316; font-weight: bold; }
    </style>
</head>
<body>

<div class="shop-name">{{ $shop->commercial_name ?? $shop->shop_name }}</div>
<div class="shop-info">
    {{ $shop->address }}@if($shop->neighborhood), {{ $shop->neighborhood }}@endif<br>
    {{ $shop->city }} — Tél : {{ $shop->owner_phone }}<br>
    @if($shop->ifu_number)IFU : {{ $shop->ifu_number }}@endif
</div>

<div class="orange-sep"></div>

<div class="invoice-header">★ FACTURE ★</div>
<table>
    <tr><td>N° :</td><td class="right"><strong>{{ $sale->invoice_number }}</strong></td></tr>
    <tr><td>Date :</td><td class="right">{{ $sale->sold_at->format('d/m/Y H:i') }}</td></tr>
    <tr><td>Caissier :</td><td class="right">{{ $sale->user->firstname }} {{ $sale->user->name }}</td></tr>
    @if($sale->client)
    <tr><td>Client :</td><td class="right">{{ $sale->client->firstname }} {{ $sale->client->name }}</td></tr>
    @endif
</table>

<div class="separator"></div>

<table>
    <tr class="items-header">
        <td class="item-name">Désignation</td>
        <td class="item-qty">Qté</td>
        <td class="item-price">P.U</td>
        <td class="item-total">Total</td>
    </tr>
    @foreach($sale->items as $item)
    <tr class="item-row">
        <td class="item-name">
            {{ Str::limit($item->productUnit->product->name, 18) }}<br>
            <span style="font-size:9px; color:#F97316;">{{ $item->productUnit->label }} ({{ ucfirst($item->sale_type) }})</span>
        </td>
        <td class="item-qty">{{ $item->quantity }}</td>
        <td class="item-price">{{ number_format($item->unit_price, 0, ',', '') }}</td>
        <td class="item-total">{{ number_format($item->total_price, 0, ',', '') }}</td>
    </tr>
    @endforeach
</table>

<div class="separator"></div>

<table class="totals">
    <tr>
        <td>Sous-total</td>
        <td>{{ number_format($sale->total_amount, 0, ',', ' ') }} F</td>
    </tr>
    @if($sale->discount_amount > 0)
    <tr><td>Remise</td><td>- {{ number_format($sale->discount_amount, 0, ',', ' ') }} F</td></tr>
    @endif
</table>

<div class="double-sep"></div>

<table class="totals">
    <tr class="total-final">
        <td>TOTAL NET</td>
        <td>{{ number_format($sale->net_amount, 0, ',', ' ') }} F</td>
    </tr>
    <tr><td>Payé</td><td>{{ number_format($sale->amount_paid, 0, ',', ' ') }} F</td></tr>
    @if($sale->amount_due > 0)
    <tr>
        <td><strong style="color:#EA580C;">Reste dû</strong></td>
        <td><strong style="color:#EA580C;">{{ number_format($sale->amount_due, 0, ',', ' ') }} F</strong></td>
    </tr>
    @if($sale->creditSale)
    <tr><td>Echéance</td><td>{{ $sale->creditSale->due_date->format('d/m/Y') }}</td></tr>
    @endif
    @endif
</table>

<div class="separator"></div>

<table>
    <tr>
        <td>Mode :</td>
        <td class="right">
            @switch($sale->payment_mode)
                @case('cash') Espèces @break
                @case('credit') Crédit @break
                @case('mobile_money') Mobile Money @break
                @case('mixed') Mixte @break
            @endswitch
        </td>
    </tr>
</table>

@if($sale->extraIdentity)
<div class="separator"></div>
<div style="font-size:10px;">
    <strong style="color:#F97316;">Acheteur Extra :</strong><br>
    {{ $sale->extraIdentity->firstname }} {{ $sale->extraIdentity->name }}<br>
    Tél : {{ $sale->extraIdentity->phone }}
</div>
@endif

<div class="orange-sep"></div>

<div class="barcode-zone">{{ $sale->invoice_number }}</div>

<div class="footer-msg">
    <strong>Merci de votre confiance !</strong><br>
    @if($shop->slogan)<em>{{ $shop->slogan }}</em><br>@endif
    <span class="stockone-badge">Stock.one</span> — {{ now()->format('d/m/Y H:i') }}
</div>

</body>
</html>
