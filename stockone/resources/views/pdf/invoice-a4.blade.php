<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Facture {{ $sale->invoice_number }}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'DejaVu Sans', Arial, sans-serif;
            font-size: 12px;
            color: #1a1a1a;
            background: #fff;
            padding: 30px;
        }

        .header {
            display: table;
            width: 100%;
            margin-bottom: 30px;
            border-bottom: 3px solid #F97316;
            padding-bottom: 20px;
        }
        .header-left  { display: table-cell; width: 60%; vertical-align: top; }
        .header-right { display: table-cell; width: 40%; vertical-align: top; text-align: right; }

        .shop-name { font-size: 22px; font-weight: bold; color: #F97316; margin-bottom: 4px; }
        .shop-info { font-size: 11px; color: #555; line-height: 1.6; }

        .invoice-title {
            font-size: 28px; font-weight: bold;
            color: #1a1a1a; text-transform: uppercase; letter-spacing: 2px;
        }
        .invoice-meta { font-size: 11px; color: #555; margin-top: 8px; line-height: 1.8; }
        .invoice-meta strong { color: #1a1a1a; }

        .parties { display: table; width: 100%; margin-bottom: 25px; }
        .party   { display: table-cell; width: 50%; vertical-align: top; }
        .party-box {
            background: #fff7ed;
            border-left: 4px solid #F97316;
            padding: 12px 15px;
            margin-right: 15px;
        }
        .party-title { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #EA580C; margin-bottom: 6px; font-weight: bold; }
        .party-name  { font-size: 13px; font-weight: bold; color: #1a1a1a; }
        .party-detail{ font-size: 11px; color: #555; margin-top: 3px; }

        .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .items-table thead tr { background: #1a1a1a; color: #fff; }
        .items-table th {
            padding: 10px 12px; text-align: left;
            font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;
        }
        .items-table th:last-child, .items-table td:last-child { text-align: right; }
        .items-table th:nth-child(3), .items-table td:nth-child(3) { text-align: center; }
        .items-table tbody tr:nth-child(even) { background: #fff7ed; }
        .items-table td { padding: 9px 12px; border-bottom: 1px solid #fed7aa; font-size: 11px; }

        .sale-type-badge {
            display: inline-block; padding: 2px 7px;
            border-radius: 10px; font-size: 9px; font-weight: bold; text-transform: uppercase;
        }
        .badge-gros   { background: #fff7ed; color: #EA580C; border: 1px solid #F97316; }
        .badge-detail { background: #1a1a1a; color: #fff; }
        .badge-extra  { background: #F97316; color: #fff; }

        .totals-wrapper { display: table; width: 100%; margin-bottom: 25px; }
        .totals-left  { display: table-cell; width: 55%; vertical-align: top; }
        .totals-right { display: table-cell; width: 45%; vertical-align: top; }

        .totals-table { width: 100%; border-collapse: collapse; }
        .totals-table td { padding: 6px 12px; font-size: 12px; }
        .totals-table td:last-child { text-align: right; font-weight: bold; }
        .totals-table .subtotal td { border-top: 1px solid #fed7aa; }
        .totals-table .discount td { color: #EA580C; }
        .totals-table .total-row td {
            background: #1a1a1a; color: #fff;
            font-size: 14px; font-weight: bold; padding: 10px 12px;
        }
        .totals-table .paid-row td { color: #16a34a; }
        .totals-table .due-row td  { color: #EA580C; font-weight: bold; }

        .payment-info {
            background: #fff7ed; border: 1px solid #fed7aa;
            border-radius: 6px; padding: 12px; font-size: 11px;
        }
        .payment-info .label { color: #888; margin-bottom: 4px; }
        .payment-info .value { font-weight: bold; font-size: 13px; color: #1a1a1a; }

        .extra-box {
            background: #fff7ed; border: 1px solid #F97316;
            border-radius: 6px; padding: 10px 14px;
            margin-bottom: 20px; font-size: 11px;
        }
        .extra-box strong { color: #EA580C; }

        .signature-zone { display: table; width: 100%; margin-top: 25px; }
        .sig-left, .sig-right {
            display: table-cell; width: 50%; text-align: center;
            padding-top: 40px; border-top: 1px solid #fed7aa;
            font-size: 10px; color: #888;
        }
        .sig-left { padding-right: 40px; }
        .sig-right { padding-left: 40px; }

        .footer {
            margin-top: 30px; padding-top: 15px;
            border-top: 2px solid #F97316;
            text-align: center; font-size: 10px; color: #888;
        }
        .footer .thank-you { font-size: 13px; font-weight: bold; color: #F97316; margin-bottom: 5px; }

        .stockone-badge {
            display: inline-block; background: #1a1a1a;
            color: #F97316; font-size: 10px; font-weight: bold;
            padding: 2px 8px; border-radius: 3px; margin-top: 4px;
        }
    </style>
</head>
<body>

<div class="header">
    <div class="header-left">
        <div class="shop-name">{{ $shop->commercial_name ?? $shop->shop_name }}</div>
        <div class="shop-info">
            {{ $shop->address }}@if($shop->neighborhood), {{ $shop->neighborhood }}@endif<br>
            {{ $shop->city }}, {{ $shop->country }}<br>
            Tél : {{ $shop->owner_phone }}@if($shop->owner_phone_secondary) / {{ $shop->owner_phone_secondary }}@endif<br>
            @if($shop->ifu_number)IFU : {{ $shop->ifu_number }}<br>@endif
            @if($shop->rccm_number)RCCM : {{ $shop->rccm_number }}@endif
        </div>
    </div>
    <div class="header-right">
        <div class="invoice-title">Facture</div>
        <div class="invoice-meta">
            <strong>N° :</strong> {{ $sale->invoice_number }}<br>
            <strong>Date :</strong> {{ $sale->sold_at->format('d/m/Y à H:i') }}<br>
            <strong>Caissier :</strong> {{ $sale->user->firstname }} {{ $sale->user->name }}
        </div>
    </div>
</div>

<div class="parties">
    <div class="party">
        <div class="party-box">
            <div class="party-title">Vendeur</div>
            <div class="party-name">{{ $shop->shop_name }}</div>
            <div class="party-detail">{{ $shop->city }}, {{ $shop->country }}</div>
        </div>
    </div>
    <div class="party">
        @if($sale->client)
        <div class="party-box" style="margin-right:0; margin-left:15px;">
            <div class="party-title">Client</div>
            <div class="party-name">{{ $sale->client->firstname }} {{ $sale->client->name }}</div>
            <div class="party-detail">{{ $sale->client->phone }}</div>
            @if($sale->client->address)<div class="party-detail">{{ $sale->client->address }}</div>@endif
        </div>
        @endif
    </div>
</div>

@if($sale->extraIdentity)
<div class="extra-box">
    <strong>Acheteur Extra :</strong>
    {{ $sale->extraIdentity->firstname }} {{ $sale->extraIdentity->name }}
    &nbsp;|&nbsp; Tél : {{ $sale->extraIdentity->phone }}
    @if($sale->extraIdentity->remarks) &nbsp;|&nbsp; {{ $sale->extraIdentity->remarks }}@endif
</div>
@endif

<table class="items-table">
    <thead>
        <tr>
            <th>#</th><th>Désignation</th><th>Type</th><th>Qté</th><th>P.U (FCFA)</th><th>Total (FCFA)</th>
        </tr>
    </thead>
    <tbody>
        @foreach($sale->items as $index => $item)
        <tr>
            <td>{{ $index + 1 }}</td>
            <td>
                {{ $item->productUnit->product->name }}
                <span style="color:#888; font-size:10px;">— {{ $item->productUnit->label }}</span>
            </td>
            <td><span class="sale-type-badge badge-{{ $item->sale_type }}">{{ ucfirst($item->sale_type) }}</span></td>
            <td style="text-align:center;">{{ $item->quantity }}</td>
            <td style="text-align:right;">{{ number_format($item->unit_price, 0, ',', ' ') }}</td>
            <td style="text-align:right;">{{ number_format($item->total_price, 0, ',', ' ') }}</td>
        </tr>
        @endforeach
    </tbody>
</table>

<div class="totals-wrapper">
    <div class="totals-left">
        <div class="payment-info">
            <div class="label">Mode de paiement</div>
            <div class="value">
                @switch($sale->payment_mode)
                    @case('cash') Espèces @break
                    @case('credit') Crédit @break
                    @case('mobile_money') Mobile Money @break
                    @case('mixed') Mixte @break
                @endswitch
            </div>
            @if($sale->creditSale)
            <div style="margin-top:8px;">
                <div class="label">Échéance crédit</div>
                <div class="value" style="color:#EA580C;">{{ $sale->creditSale->due_date->format('d/m/Y') }}</div>
            </div>
            @endif
        </div>
    </div>
    <div class="totals-right">
        <table class="totals-table">
            <tr class="subtotal">
                <td>Sous-total</td>
                <td>{{ number_format($sale->total_amount, 0, ',', ' ') }} FCFA</td>
            </tr>
            @if($sale->discount_amount > 0)
            <tr class="discount">
                <td>Remise</td>
                <td>- {{ number_format($sale->discount_amount, 0, ',', ' ') }} FCFA</td>
            </tr>
            @endif
            <tr class="total-row">
                <td>TOTAL NET</td>
                <td>{{ number_format($sale->net_amount, 0, ',', ' ') }} FCFA</td>
            </tr>
            <tr class="paid-row">
                <td>Montant payé</td>
                <td>{{ number_format($sale->amount_paid, 0, ',', ' ') }} FCFA</td>
            </tr>
            @if($sale->amount_due > 0)
            <tr class="due-row">
                <td>Reste dû</td>
                <td>{{ number_format($sale->amount_due, 0, ',', ' ') }} FCFA</td>
            </tr>
            @endif
        </table>
    </div>
</div>

<div class="signature-zone">
    <div class="sig-left">Signature du caissier</div>
    <div class="sig-right">Signature du client</div>
</div>

<div class="footer">
    <div class="thank-you">Merci de votre confiance !</div>
    @if($shop->slogan)<em>{{ $shop->slogan }}</em><br>@endif
    <span class="stockone-badge">Stock.one</span>
    <span style="margin-left:8px;">Document généré le {{ now()->format('d/m/Y à H:i') }}</span>
</div>

</body>
</html>
