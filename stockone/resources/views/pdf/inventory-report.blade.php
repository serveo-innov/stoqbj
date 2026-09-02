<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Inventaire #{{ $inventory->id }}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'DejaVu Sans', Arial, sans-serif; font-size: 11px; color: #1a1a1a; padding: 25px; }

        .header {
            display: table; width: 100%;
            border-bottom: 3px solid #F97316;
            padding-bottom: 15px; margin-bottom: 20px;
        }
        .header-left  { display: table-cell; width: 60%; vertical-align: middle; }
        .header-right { display: table-cell; width: 40%; vertical-align: middle; text-align: right; }
        .shop-name    { font-size: 18px; font-weight: bold; color: #F97316; }
        .report-title { font-size: 20px; font-weight: bold; color: #1a1a1a; }
        .report-meta  { font-size: 11px; color: #555; margin-top: 4px; line-height: 1.6; }
        .report-meta strong { color: #1a1a1a; }

        .kpi-grid { display: table; width: 100%; margin-bottom: 20px; }
        .kpi-row  { display: table-row; }
        .kpi-cell { display: table-cell; width: 25%; padding: 5px; }
        .kpi-box  { background: #fff7ed; border-left: 4px solid #F97316; padding: 12px; border-radius: 4px; }
        .kpi-label{ font-size: 10px; color: #EA580C; text-transform: uppercase; letter-spacing: 0.5px; font-weight: bold; }
        .kpi-value{ font-size: 18px; font-weight: bold; color: #1a1a1a; margin-top: 4px; }
        .kpi-sub  { font-size: 10px; color: #555; margin-top: 2px; }

        h3 {
            font-size: 13px; color: #fff;
            background: #1a1a1a;
            padding: 6px 12px;
            margin-bottom: 12px; margin-top: 20px;
            border-left: 4px solid #F97316;
        }

        table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
        th { background: #1a1a1a; color: #F97316; padding: 8px 10px; text-align: left; font-size: 10px; text-transform: uppercase; }
        th:last-child, td:last-child { text-align: right; }
        td { padding: 7px 10px; border-bottom: 1px solid #fed7aa; font-size: 11px; }
        tr:nth-child(even) td { background: #fff7ed; }

        .gap-positive { color: #16a34a; font-weight: bold; }
        .gap-negative { color: #dc2626; font-weight: bold; }
        .gap-zero     { color: #888; }

        .confidential {
            background: #fff7ed; border: 1px solid #F97316;
            border-radius: 4px; padding: 8px 12px;
            font-size: 10px; color: #EA580C; margin-bottom: 15px;
        }

        .footer {
            margin-top: 30px; padding-top: 12px;
            border-top: 2px solid #F97316;
            text-align: center; font-size: 10px; color: #888;
        }
        .stockone-badge {
            background: #1a1a1a; color: #F97316;
            font-size: 10px; font-weight: bold;
            padding: 2px 8px; border-radius: 3px;
        }
        .signature-zone { display: table; width: 100%; margin-top: 30px; }
        .sig-left, .sig-right {
            display: table-cell; width: 50%; text-align: center;
            padding-top: 40px; border-top: 1px solid #fed7aa;
            font-size: 10px; color: #888;
        }
        .sig-left { padding-right: 40px; }
        .sig-right { padding-left: 40px; }
    </style>
</head>
<body>

<div class="header">
    <div class="header-left">
        <div class="shop-name">{{ $shop->commercial_name ?? $shop->shop_name }}</div>
        <div style="font-size:10px; color:#555; margin-top:3px;">{{ $shop->address }}, {{ $shop->city }}</div>
    </div>
    <div class="header-right">
        <div class="report-title">Rapport d'Inventaire</div>
        <div class="report-meta">
            <strong>N° :</strong> #{{ $inventory->id }}<br>
            <strong>Date :</strong> {{ $inventory->validated_at?->format('d/m/Y à H:i') ?? $inventory->created_at->format('d/m/Y à H:i') }}<br>
            <strong>Realise par :</strong> {{ $inventory->createdBy->firstname ?? '' }} {{ $inventory->createdBy->name ?? '' }}
        </div>
    </div>
</div>

<div class="confidential">⚠️ Document confidentiel — Preuve de comptage physique, usage interne</div>

@php
    $totalItems  = $inventory->items->count();
    $discrepancies = $inventory->items->where('gap', '!=', 0)->count();
@endphp

<div class="kpi-grid">
    <div class="kpi-row">
        <div class="kpi-cell">
            <div class="kpi-box">
                <div class="kpi-label">Produits comptes</div>
                <div class="kpi-value">{{ $totalItems }}</div>
            </div>
        </div>
        <div class="kpi-cell">
            <div class="kpi-box">
                <div class="kpi-label">Ecarts constates</div>
                <div class="kpi-value">{{ $discrepancies }}</div>
            </div>
        </div>
        <div class="kpi-cell">
            <div class="kpi-box">
                <div class="kpi-label">Valeur des ecarts</div>
                <div class="kpi-value" style="font-size:14px;">{{ number_format($totalValueImpact, 0, ',', ' ') }}</div>
                <div class="kpi-sub">FCFA</div>
            </div>
        </div>
        <div class="kpi-cell">
            <div class="kpi-box">
                <div class="kpi-label">Statut</div>
                <div class="kpi-value" style="font-size:14px;">Valide</div>
            </div>
        </div>
    </div>
</div>

@if($inventory->notes)
<h3>Notes</h3>
<p style="font-size:11px; margin-bottom:15px;">{{ $inventory->notes }}</p>
@endif

<h3>Detail du comptage</h3>
<table>
    <thead>
        <tr>
            <th>Produit</th>
            <th>Unite</th>
            <th style="text-align:center;">Theorique</th>
            <th style="text-align:center;">Compte</th>
            <th style="text-align:center;">Ecart</th>
            <th>Valeur ecart (FCFA)</th>
        </tr>
    </thead>
    <tbody>
        @foreach($inventory->items as $item)
        @php
            $costPrice = (float) ($item->productUnit->cost_price ?? 0);
            $value = $item->gap * $costPrice;
            $gapClass = $item->gap > 0 ? 'gap-positive' : ($item->gap < 0 ? 'gap-negative' : 'gap-zero');
        @endphp
        <tr>
            <td>{{ $item->productUnit->product->name ?? '—' }}</td>
            <td>{{ $item->productUnit->label ?? '—' }}</td>
            <td style="text-align:center;">{{ $item->theoretical_qty }}</td>
            <td style="text-align:center;">{{ $item->physical_qty }}</td>
            <td style="text-align:center;" class="{{ $gapClass }}">{{ $item->gap > 0 ? '+' : '' }}{{ $item->gap }}</td>
            <td class="{{ $gapClass }}">{{ number_format($value, 0, ',', ' ') }}</td>
        </tr>
        @endforeach
    </tbody>
</table>

<div class="signature-zone">
    <div class="sig-left">Signature du responsable comptage</div>
    <div class="sig-right">Signature du gerant</div>
</div>

<div class="footer">
    Rapport genere le {{ now()->format('d/m/Y à H:i') }} &nbsp;|&nbsp;
    <span class="stockone-badge">Stoq.bj</span> &nbsp;|&nbsp;
    {{ $shop->shop_name }} &nbsp;|&nbsp; Document confidentiel
</div>

</body>
</html>
