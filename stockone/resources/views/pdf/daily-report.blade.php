<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Rapport du {{ $report->report_date->format('d/m/Y') }}</title>
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
        .report-date  { font-size: 13px; color: #555; margin-top: 4px; }

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

        .ca-breakdown { display: table; width: 100%; margin-bottom: 20px; }
        .ca-cell { display: table-cell; width: 33.33%; padding: 5px; }
        .ca-box  { text-align: center; padding: 15px; border-radius: 6px; }
        .ca-gros   { background: #1a1a1a; }
        .ca-detail { background: #F97316; }
        .ca-extra  { background: #EA580C; }
        .ca-label  { font-size: 10px; font-weight: bold; text-transform: uppercase; margin-bottom: 6px; color: #fff; }
        .ca-amount { font-size: 16px; font-weight: bold; color: #fff; }

        .footer {
            margin-top: 30px; padding-top: 12px;
            border-top: 2px solid #F97316;
            text-align: center; font-size: 10px; color: #888;
        }
        .confidential {
            background: #fff7ed; border: 1px solid #F97316;
            border-radius: 4px; padding: 8px 12px;
            font-size: 10px; color: #EA580C; margin-bottom: 15px;
        }
        .stockone-badge {
            background: #1a1a1a; color: #F97316;
            font-size: 10px; font-weight: bold;
            padding: 2px 8px; border-radius: 3px;
        }
    </style>
</head>
<body>

<div class="header">
    <div class="header-left">
        <div class="shop-name">{{ $shop->commercial_name ?? $shop->shop_name }}</div>
        <div style="font-size:10px; color:#555; margin-top:3px;">{{ $shop->address }}, {{ $shop->city }}</div>
    </div>
    <div class="header-right">
        <div class="report-title">Rapport Quotidien</div>
        <div class="report-date">{{ $report->report_date->format('l d F Y') }}</div>
    </div>
</div>

<div class="confidential">⚠️ Document confidentiel — Usage interne uniquement</div>

<div class="kpi-grid">
    <div class="kpi-row">
        <div class="kpi-cell">
            <div class="kpi-box">
                <div class="kpi-label">CA Total</div>
                <div class="kpi-value">{{ number_format($report->ca_total, 0, ',', ' ') }}</div>
                <div class="kpi-sub">FCFA</div>
            </div>
        </div>
        <div class="kpi-cell">
            <div class="kpi-box">
                <div class="kpi-label">Encaissements</div>
                <div class="kpi-value">{{ number_format($report->encaissements, 0, ',', ' ') }}</div>
                <div class="kpi-sub">FCFA</div>
            </div>
        </div>
        <div class="kpi-cell">
            <div class="kpi-box">
                <div class="kpi-label">Transactions</div>
                <div class="kpi-value">{{ $report->nb_transactions }}</div>
                <div class="kpi-sub">ventes</div>
            </div>
        </div>
        <div class="kpi-cell">
            <div class="kpi-box">
                <div class="kpi-label">Credits accordes</div>
                <div class="kpi-value">{{ number_format($report->credits_accordes, 0, ',', ' ') }}</div>
                <div class="kpi-sub">FCFA ({{ $report->nb_new_credits }} ventes)</div>
            </div>
        </div>
    </div>
</div>

<h3>Repartition du Chiffre d'Affaires</h3>
<div class="ca-breakdown">
    <div class="ca-cell">
        <div class="ca-box ca-gros">
            <div class="ca-label">Ventes Gros</div>
            <div class="ca-amount">{{ number_format($report->ca_gros, 0, ',', ' ') }} F</div>
        </div>
    </div>
    <div class="ca-cell">
        <div class="ca-box ca-detail">
            <div class="ca-label">Ventes Detail</div>
            <div class="ca-amount">{{ number_format($report->ca_detail, 0, ',', ' ') }} F</div>
        </div>
    </div>
    <div class="ca-cell">
        <div class="ca-box ca-extra">
            <div class="ca-label">Ventes Extra</div>
            <div class="ca-amount">{{ number_format($report->ca_extra, 0, ',', ' ') }} F</div>
        </div>
    </div>
</div>

@if($report->top_products && count($report->top_products))
<h3>Top Produits du Jour</h3>
<table>
    <thead><tr><th>#</th><th>Produit</th><th>Quantite vendue</th><th>CA (FCFA)</th></tr></thead>
    <tbody>
        @foreach($report->top_products as $index => $product)
        <tr>
            <td>{{ $index + 1 }}</td>
            <td>{{ $product['name'] }}</td>
            <td>{{ $product['qty'] }}</td>
            <td>{{ number_format($product['ca'], 0, ',', ' ') }}</td>
        </tr>
        @endforeach
    </tbody>
</table>
@endif

@if($report->stock_alerts && count($report->stock_alerts))
<h3>Alertes Stock</h3>
<table>
    <thead><tr><th>Produit</th><th>Stock actuel</th><th>Statut</th></tr></thead>
    <tbody>
        @foreach($report->stock_alerts as $alert)
        <tr>
            <td>{{ $alert['name'] }}</td>
            <td>{{ $alert['stock'] }}</td>
            <td style="color:{{ $alert['stock'] <= 0 ? '#EA580C' : '#F97316' }}; font-weight:bold;">
                {{ $alert['stock'] <= 0 ? 'Rupture de stock' : 'Stock bas' }}
            </td>
        </tr>
        @endforeach
    </tbody>
</table>
@endif

<h3>Mouvements de Credits</h3>
<table>
    <thead><tr><th>Indicateur</th><th>Montant (FCFA)</th></tr></thead>
    <tbody>
        <tr><td>Credits accordes aujourd'hui</td><td>{{ number_format($report->credits_accordes, 0, ',', ' ') }}</td></tr>
        <tr><td>Credits percus aujourd'hui</td><td>{{ number_format($report->credits_percus, 0, ',', ' ') }}</td></tr>
    </tbody>
</table>

<div class="footer">
    Rapport genere le {{ now()->format('d/m/Y a H:i') }} &nbsp;|&nbsp;
    <span class="stockone-badge">Stock.one</span> &nbsp;|&nbsp;
    {{ $shop->shop_name }} &nbsp;|&nbsp; Document confidentiel
</div>

</body>
</html>
