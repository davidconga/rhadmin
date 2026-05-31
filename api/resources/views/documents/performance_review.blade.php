<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="utf-8">
<style>
* { font-family: DejaVu Sans, sans-serif; font-size: 10px; color: #1f2937; margin: 0; padding: 0; box-sizing: border-box; }
body { padding: 30px 40px; }

.header { border-bottom: 3px solid #085041; padding-bottom: 10px; margin-bottom: 14px; }
.header table { width: 100%; }
.doc-title { font-size: 14px; font-weight: bold; color: #085041; }
.doc-sub { font-size: 8.5px; color: #6b7280; margin-top: 2px; }
.badge { background: #085041; color: #fff; font-size: 9px; font-weight: bold; padding: 4px 12px; border-radius: 3px; display: inline-block; }

.section { margin-bottom: 12px; }
.section-title { background: #085041; color: #fff; font-size: 9.5px; font-weight: bold; padding: 4px 10px; letter-spacing: 0.3px; }

table.info { width: 100%; border-collapse: collapse; }
table.info td { border: 1px solid #d1d5db; padding: 4px 8px; }
table.info .lbl { width: 20%; background: #f0fdf4; font-size: 8.5px; color: #374151; font-weight: bold; }

/* Escala */
table.scale { width: 100%; border-collapse: collapse; }
table.scale td { border: 1px solid #d1d5db; padding: 4px 6px; text-align: center; }
table.scale .num { background: #085041; color: #fff; font-weight: bold; width: 30px; }
table.scale .label-1 { background: #fee2e2; color: #991b1b; }
table.scale .label-2 { background: #ffedd5; color: #9a3412; }
table.scale .label-3 { background: #fef9c3; color: #854d0e; }
table.scale .label-4 { background: #dbeafe; color: #1e40af; }
table.scale .label-5 { background: #dcfce7; color: #065f46; }

/* Critérios */
table.crit { width: 100%; border-collapse: collapse; }
table.crit th { border: 1px solid #d1d5db; padding: 4px 8px; background: #f0fdf4; font-size: 8.5px; color: #065f46; text-transform: uppercase; letter-spacing: 0.3px; }
table.crit th.c { text-align: center; width: 55px; }
table.crit th.obs { width: 32%; }
table.crit td { border: 1px solid #e5e7eb; padding: 5px 8px; vertical-align: middle; font-size: 9.5px; }
table.crit td.obs { background: #fafafa; }
table.crit td.score { text-align: center; font-weight: bold; font-size: 13px; }
.score-0 { color: #d1d5db; }
.score-1 { color: #dc2626; }
.score-2 { color: #ea580c; }
.score-3 { color: #ca8a04; }
.score-4 { color: #2563eb; }
.score-5 { color: #16a34a; }
.subtotal { background: #f0fdf4 !important; font-weight: bold; }
.subtotal td { border-top: 1.5px solid #085041 !important; font-size: 9.5px; }
.subtotal .right { text-align: right; color: #085041; }

/* Total */
.total-box { border: 2px solid #085041; border-radius: 4px; padding: 10px 14px; margin: 12px 0; }
.big-score { font-size: 28px; font-weight: bold; color: #085041; }
.class-tag { display: inline-block; padding: 3px 12px; border-radius: 12px; font-weight: bold; font-size: 11px; }
.cls-exc { background: #dcfce7; color: #065f46; }
.cls-bom { background: #dbeafe; color: #1e40af; }
.cls-sat { background: #fef9c3; color: #854d0e; }
.cls-mel { background: #ffedd5; color: #9a3412; }
.cls-ins { background: #fee2e2; color: #991b1b; }

/* Comentários */
table.comments { width: 100%; border-collapse: collapse; margin-top: 6px; }
table.comments td { border: 1px solid #e5e7eb; padding: 5px 8px; }
table.comments .lbl { background: #f0fdf4; font-weight: bold; font-size: 8.5px; color: #374151; width: 22%; }
table.comments .val { min-height: 30px; vertical-align: top; }

/* Assinaturas */
table.sigs { width: 100%; border-collapse: collapse; margin-top: 10px; }
table.sigs td { border: 1px solid #d1d5db; padding: 8px 12px; width: 50%; }
.sig-line { border-bottom: 1px solid #374151; margin-top: 26px; margin-bottom: 3px; }
.sig-lbl { font-size: 8px; color: #6b7280; }

.footer { margin-top: 12px; border-top: 1px solid #e5e7eb; padding-top: 7px; font-size: 8px; color: #9ca3af; }
</style>
</head>
<body>

{{-- CABEÇALHO --}}
<div class="header">
  <table>
    <tr>
      <td style="border:none;padding:0;width:65%;vertical-align:middle">
        <div class="doc-title">FICHA DE AVALIAÇÃO DE DESEMPENHO</div>
        <div class="doc-sub">{{ $companyName }}@if($companyNif) &nbsp;·&nbsp; NIF: {{ $companyNif }}@endif</div>
      </td>
      <td style="border:none;padding:0;text-align:right;vertical-align:middle">
        <div class="badge">{{ strtoupper($periodLabel) }}</div>
        <div style="font-size:8px;color:#6b7280;margin-top:3px;">Gerado em {{ $generatedAt }}</div>
      </td>
    </tr>
  </table>
</div>

{{-- I. DADOS DO FUNCIONÁRIO --}}
<div class="section">
  <div class="section-title">I. DADOS DO FUNCIONÁRIO</div>
  <table class="info">
    <tr>
      <td class="lbl">Nome completo</td>
      <td style="font-weight:bold">{{ $employee->full_name }}</td>
      <td class="lbl">Nº funcionário</td>
      <td>{{ str_pad($employee->id, 4, '0', STR_PAD_LEFT) }}</td>
    </tr>
    <tr>
      <td class="lbl">Cargo / Função</td>
      <td>{{ $employee->position ?? '—' }}</td>
      <td class="lbl">Departamento</td>
      <td>{{ $employee->department ?? '—' }}</td>
    </tr>
    <tr>
      <td class="lbl">Avaliador</td>
      <td>{{ $reviewerName }}</td>
      <td class="lbl">Data da avaliação</td>
      <td>{{ $conductedAt }}</td>
    </tr>
    <tr>
      <td class="lbl">Período avaliado</td>
      <td>{{ $periodLabel }}</td>
      <td class="lbl">Método</td>
      <td>{{ $methodLabel }}</td>
    </tr>
  </table>
</div>

{{-- ESCALA --}}
<div class="section">
  <div class="section-title">ESCALA DE PONTUAÇÃO</div>
  <table class="scale">
    <tr>
      <td class="num">1</td><td class="label-1">Insuficiente</td>
      <td class="num">2</td><td class="label-2">Necessita melhoria</td>
      <td class="num">3</td><td class="label-3">Satisfatório</td>
      <td class="num">4</td><td class="label-4">Bom</td>
      <td class="num">5</td><td class="label-5">Excelente</td>
    </tr>
  </table>
</div>

{{-- CRITÉRIOS POR CATEGORIA --}}
@php
$romanNums = ['II','III','IV','V','VI','VII','VIII','IX','X'];
$si = 0;
$grandTotal = 0;
$grandMax   = 0;
@endphp

@foreach($groupedScores as $category => $catScores)
@php
$subtotal = $catScores->sum('score');
$maxPts   = $catScores->count() * 5;
$grandTotal += $subtotal;
$grandMax   += $maxPts;
@endphp
<div class="section">
  <div class="section-title">{{ $romanNums[$si++] }}. {{ strtoupper($category) }}</div>
  <table class="crit">
    <thead>
      <tr>
        <th style="text-align:left">Critério</th>
        <th class="obs" style="text-align:left">Observação</th>
        <th class="c">Peso</th>
        <th class="c">Nota</th>
      </tr>
    </thead>
    <tbody>
      @foreach($catScores as $s)
      <tr>
        <td>{{ $s->criterion->name }}</td>
        <td class="obs" style="font-size:8.5px;color:#6b7280">{{ $s->comment ?? '' }}</td>
        <td style="text-align:center;color:#6b7280">{{ $s->criterion->weight }}%</td>
        <td class="score score-{{ $s->score }}">{{ $s->score > 0 ? $s->score : '—' }}</td>
      </tr>
      @endforeach
      <tr class="subtotal">
        <td colspan="3">Subtotal &nbsp;·&nbsp; <span style="font-size:8.5px;color:#6b7280;font-weight:normal">{{ $catScores->where('score','>',0)->count() }} de {{ $catScores->count() }} critérios preenchidos</span></td>
        <td class="right">{{ $subtotal }} / {{ $maxPts }}</td>
      </tr>
    </tbody>
  </table>
</div>
@endforeach

{{-- PONTUAÇÃO TOTAL --}}
@php
$pct = $grandMax > 0 ? ($grandTotal / $grandMax) * 100 : 0;
if ($pct >= 90)      { $finalClass = 'Excelente';         $cls = 'cls-exc'; }
elseif ($pct >= 78)  { $finalClass = 'Bom';               $cls = 'cls-bom'; }
elseif ($pct >= 57)  { $finalClass = 'Satisfatório';      $cls = 'cls-sat'; }
elseif ($pct >= 35)  { $finalClass = 'Necessita melhoria';$cls = 'cls-mel'; }
else                 { $finalClass = 'Insuficiente';       $cls = 'cls-ins'; }
@endphp
<div class="total-box">
  <table style="width:100%">
    <tr>
      <td style="border:none;padding:0;vertical-align:middle">
        <div style="font-size:11px;font-weight:bold;color:#1f2937">PONTUAÇÃO TOTAL</div>
        <div style="font-size:8px;color:#6b7280;margin-top:2px">{{ $grandTotal }} pontos de {{ $grandMax }} possíveis &nbsp;({{ round($pct) }}%)</div>
        <div style="margin-top:6px"><span class="class-tag {{ $cls }}">{{ $finalClass }}</span></div>
      </td>
      <td style="border:none;padding:0;text-align:right;vertical-align:middle">
        <span class="big-score">{{ $grandTotal }}</span>
        <span style="font-size:13px;color:#6b7280"> / {{ $grandMax }}</span>
      </td>
    </tr>
  </table>
</div>

{{-- COMENTÁRIOS --}}
<div class="section">
  <div class="section-title">{{ $romanNums[$si++] }}. COMENTÁRIOS E PLANO DE DESENVOLVIMENTO</div>
  <table class="comments">
    <tr>
      <td class="lbl">Pontos fortes:</td>
      <td class="val"></td>
    </tr>
    <tr>
      <td class="lbl">Áreas a melhorar:</td>
      <td class="val"></td>
    </tr>
    <tr>
      <td class="lbl">Comentário do avaliador:</td>
      <td class="val" style="font-size:9.5px">{{ $reviewerComments ?? '' }}</td>
    </tr>
    <tr>
      <td class="lbl">Objectivos próximo período:</td>
      <td class="val"></td>
    </tr>
  </table>
</div>

{{-- ASSINATURAS --}}
<table class="sigs">
  <tr>
    <td>
      <div style="font-size:8.5px;font-weight:bold;margin-bottom:3px;color:#065f46">AVALIADOR</div>
      <div class="sig-line"></div>
      <div class="sig-lbl">Nome: {{ $reviewerName }}</div>
      <div class="sig-lbl" style="margin-top:3px">Data: _____ / _____ / _______</div>
    </td>
    <td>
      <div style="font-size:8.5px;font-weight:bold;margin-bottom:3px;color:#065f46">FUNCIONÁRIO AVALIADO</div>
      <div class="sig-line"></div>
      <div class="sig-lbl">Nome: {{ $employee->full_name }}</div>
      <div class="sig-lbl" style="margin-top:3px">Data: _____ / _____ / _______</div>
    </td>
  </tr>
</table>

<div class="footer">
  RHadmin — Software de Gestão de RH para Angola e Moçambique &nbsp;·&nbsp; {{ $companyName }} &nbsp;·&nbsp; {{ $generatedAt }}
</div>

</body>
</html>
