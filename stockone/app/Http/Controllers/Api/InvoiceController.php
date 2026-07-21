<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DailyReport;
use App\Models\Sale;
use App\Models\StationeryShop;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use OpenApi\Attributes as OA;

#[OA\Tag(name: 'Facturation', description: 'Generation de factures et rapports PDF')]
class InvoiceController extends Controller
{
    use ResolvesShopId;

    /**
     * Télécharger la facture A4 d'une vente
     */
    #[OA\Get(
        path: '/invoices/{saleId}/a4',
        summary: 'Telecharger facture A4',
        security: [['bearerAuth' => []]],
        tags: ['Facturation'],
        parameters: [
            new OA\Parameter(name: 'saleId', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'PDF retourne'),
            new OA\Response(response: 404, description: 'Vente introuvable'),
        ]
    )]
    public function invoiceA4(Request $request, int $saleId): Response
    {
        $shopId = $this->requireShopId($request);

        $sale = Sale::where('shop_id', $shopId)
            ->with([
                'items.productUnit.product',
                'user',
                'client',
                'extraIdentity',
                'creditSale',
            ])
            ->findOrFail($saleId);

        $shop = StationeryShop::findOrFail($shopId);

        $pdf = Pdf::loadView('pdf.invoice-a4', compact('sale', 'shop'))
            ->setPaper('a4', 'portrait')
            ->setOptions([
                'defaultFont' => 'DejaVu Sans',
                'isRemoteEnabled' => false,
                'isHtml5ParserEnabled' => true,
                'chroot' => public_path(),
            ]);

        $filename = "facture-{$sale->invoice_number}.pdf";

        // Marquer comme imprimée
        $sale->update(['invoice_printed' => true]);

        return $pdf->download($filename);
    }

    /**
     * Télécharger le ticket thermique 80mm
     */
    #[OA\Get(
        path: '/invoices/{saleId}/ticket',
        summary: 'Telecharger ticket thermique 80mm',
        security: [['bearerAuth' => []]],
        tags: ['Facturation'],
        parameters: [
            new OA\Parameter(name: 'saleId', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [new OA\Response(response: 200, description: 'Ticket PDF retourne')]
    )]
    public function ticket80mm(Request $request, int $saleId): Response
    {
        $shopId = $this->requireShopId($request);

        $sale = Sale::where('shop_id', $shopId)
            ->with([
                'items.productUnit.product',
                'user',
                'client',
                'extraIdentity',
                'creditSale',
            ])
            ->findOrFail($saleId);

        $shop = StationeryShop::findOrFail($shopId);

        // Largeur ticket 80mm = ~227 points PDF
        $pdf = Pdf::loadView('pdf.ticket-80mm', compact('sale', 'shop'))
            ->setPaper([0, 0, 227, 600], 'portrait')
            ->setOptions([
                'defaultFont'          => 'DejaVu Sans',
                'isRemoteEnabled'      => false,
                'isHtml5ParserEnabled' => true,
            ]);

        $filename = "ticket-{$sale->invoice_number}.pdf";

        $sale->update(['invoice_printed' => true]);

        return $pdf->download($filename);
    }

    /**
     * Télécharger le rapport quotidien PDF
     */
    #[OA\Get(
        path: '/invoices/report/daily',
        summary: 'Telecharger rapport quotidien PDF',
        security: [['bearerAuth' => []]],
        tags: ['Facturation'],
        parameters: [
            new OA\Parameter(name: 'date', in: 'query', schema: new OA\Schema(type: 'string', format: 'date')),
        ],
        responses: [new OA\Response(response: 200, description: 'Rapport PDF retourne')]
    )]
    public function dailyReportPdf(Request $request): Response
    {
        $shopId = $this->requireShopId($request);
        $date   = $request->date ? \Carbon\Carbon::parse($request->date) : today();
        $shop   = StationeryShop::findOrFail($shopId);

        // Récupérer ou générer le rapport
        $report = DailyReport::where('shop_id', $shopId)
            ->where('report_date', $date->toDateString())
            ->first();

        if (! $report) {
            // Générer via le ReportController
            $reportController = new ReportController();
            $report = $reportController->generateDailyReportPublic($shopId, $date);
        }

        $pdf = Pdf::loadView('pdf.daily-report', compact('report', 'shop'))
            ->setPaper('a4', 'portrait')
            ->setOptions([
                'defaultFont'          => 'DejaVu Sans',
                'isRemoteEnabled'      => false,
                'isHtml5ParserEnabled' => true,
            ]);

        $shopSlug = $shop->commercial_name ?? $shop->id;
        $filename = "rapport-{$date->format('Y-m-d')}-{$shopSlug}.pdf";

        // Sauvegarder le chemin PDF
        $pdfPath = "reports/{$shopId}/{$filename}";
        $report->update(['pdf_path' => $pdfPath]);

        return $pdf->download($filename);
    }

    /**
     * Prévisualiser la facture dans le navigateur (stream)
     */
    #[OA\Get(
        path: '/invoices/{saleId}/preview',
        summary: 'Previsualiser facture dans le navigateur',
        security: [['bearerAuth' => []]],
        tags: ['Facturation'],
        parameters: [
            new OA\Parameter(name: 'saleId', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
            new OA\Parameter(name: 'format', in: 'query', schema: new OA\Schema(type: 'string', enum: ['a4', 'ticket'], default: 'a4')),
        ],
        responses: [new OA\Response(response: 200, description: 'PDF affiche dans le navigateur')]
    )]
    public function preview(Request $request, int $saleId): Response
    {
        $shopId = $this->requireShopId($request);
        $format = $request->get('format', 'a4');

        $sale = Sale::where('shop_id', $shopId)
            ->with(['items.productUnit.product', 'user', 'client', 'extraIdentity', 'creditSale'])
            ->findOrFail($saleId);

        $shop = StationeryShop::findOrFail($shopId);

        if ($format === 'ticket') {
            $pdf = Pdf::loadView('pdf.ticket-80mm', compact('sale', 'shop'))
                ->setPaper([0, 0, 227, 600], 'portrait');
        } else {
            $pdf = Pdf::loadView('pdf.invoice-a4', compact('sale', 'shop'))
                ->setPaper('a4', 'portrait');
        }

        $pdf->setOptions([
            'defaultFont'          => 'DejaVu Sans',
            'isRemoteEnabled'      => false,
            'isHtml5ParserEnabled' => true,
        ]);

        return $pdf->stream("apercu-{$sale->invoice_number}.pdf");
    }
}
