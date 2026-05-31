<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="utf-8">
<style>
* { font-family: DejaVu Sans, sans-serif; font-size: 11px; color: #1f2937; }
body { margin: 0; padding: 0; }
.page { padding: 40px 50px; }
.header { border-bottom: 3px solid #085041; padding-bottom: 14px; margin-bottom: 20px; }
.header table { width: 100%; }
.logo { width: 80px; }
.company-name { font-size: 17px; font-weight: bold; color: #085041; }
.company-sub { font-size: 9px; color: #6b7280; }
.doc-title { font-size: 15px; font-weight: bold; color: #085041; text-align: center; margin: 18px 0 4px; text-transform: uppercase; letter-spacing: 1px; }
.doc-sub { font-size: 10px; color: #6b7280; text-align: center; margin-bottom: 18px; }
.divider { border: none; border-top: 1px solid #e5e7eb; margin: 14px 0; }
.section-title { font-size: 11px; font-weight: bold; color: #085041; text-transform: uppercase; letter-spacing: 0.5px; margin: 16px 0 6px; border-left: 3px solid #085041; padding-left: 8px; }
p { margin: 5px 0; line-height: 1.7; text-align: justify; }
.parties-table { width: 100%; border-collapse: collapse; margin: 8px 0; }
.parties-table td { padding: 3px 6px; vertical-align: top; }
.parties-table .label { color: #6b7280; width: 160px; }
.highlight { font-weight: bold; color: #085041; }
.sign { margin-top: 50px; }
.sign table { width: 100%; }
.sign td { width: 50%; text-align: center; vertical-align: bottom; padding: 0 20px; }
.sign .sig-img { max-height: 48px; margin-bottom: 4px; }
.sign .line { border-top: 1px solid #374151; margin: 0 20px; padding-top: 5px; font-size: 10px; }
.footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #e5e7eb; font-size: 9px; color: #9ca3af; text-align: center; }
.badge { display: inline-block; background: #ecfdf5; color: #065f46; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; }
</style>
</head>
<body>
<div class="page">

  {{-- Cabeçalho --}}
  <div class="header">
    <table>
      <tr>
        <td style="width:90px">
          @if($logoData)
            <img src="{{ $logoData }}" class="logo" alt="logo">
          @endif
        </td>
        <td>
          <div class="company-name">{{ $company->name }}</div>
          <div class="company-sub">
            @if($company->nif) NIF: {{ $company->nif }} &nbsp;·&nbsp; @endif
            @if($company->address) {{ $company->address }} @endif
          </div>
        </td>
      </tr>
    </table>
  </div>

  {{-- Título --}}
  <div class="doc-title">{{ $typeLabel }} de Trabalho</div>
  <div class="doc-sub">
    Celebrado ao abrigo da Lei Geral do Trabalho — Lei n.º 7/15, de 15 de Junho de 2015
    &nbsp;·&nbsp; <span class="badge">{{ strtoupper(substr($contract->status, 0, 1)) . substr($contract->status, 1) }}</span>
  </div>

  <hr class="divider">

  {{-- Cláusula 1 — Identificação das Partes --}}
  <div class="section-title">Cláusula 1.ª — Identificação das Partes</div>
  <p>Entre as partes abaixo identificadas é celebrado o presente contrato de trabalho:</p>

  <p style="margin-top:10px"><strong>PRIMEIRA PARTE — ENTIDADE EMPREGADORA:</strong></p>
  <table class="parties-table">
    <tr><td class="label">Denominação social:</td><td><strong>{{ $company->name }}</strong></td></tr>
    @if($company->nif)
    <tr><td class="label">NIF:</td><td>{{ $company->nif }}</td></tr>
    @endif
    @if($company->address)
    <tr><td class="label">Sede:</td><td>{{ $company->address }}</td></tr>
    @endif
  </table>

  <p style="margin-top:8px"><strong>SEGUNDA PARTE — TRABALHADOR:</strong></p>
  <table class="parties-table">
    <tr><td class="label">Nome completo:</td><td><strong>{{ $employee->full_name }}</strong></td></tr>
    @if($employee->bi_nif)
    <tr><td class="label">BI / NIF:</td><td>{{ $employee->bi_nif }}</td></tr>
    @endif
    @if($employee->email)
    <tr><td class="label">Email:</td><td>{{ $employee->email }}</td></tr>
    @endif
    @if($employee->phone)
    <tr><td class="label">Contacto:</td><td>{{ $employee->phone }}</td></tr>
    @endif
  </table>

  <hr class="divider">

  {{-- Cláusula 2 — Objecto e Funções --}}
  <div class="section-title">Cláusula 2.ª — Objecto e Funções</div>
  <p>
    O trabalhador é admitido para exercer as funções de
    <span class="highlight">{{ $contract->position ?: 'acordo com as necessidades da empresa' }}</span>
    @if($contract->department)
      , integrando o departamento de <span class="highlight">{{ $contract->department }}</span>
    @endif
    , comprometendo-se a cumprir as tarefas que lhe forem atribuídas de acordo com a sua categoria profissional e nos termos do artigo 72.º da LGT.
  </p>
  @if($contract->title)
  <p>Título do contrato: <em>{{ $contract->title }}</em></p>
  @endif

  <hr class="divider">

  {{-- Cláusula 3 — Duração --}}
  <div class="section-title">Cláusula 3.ª — Duração e Vigência</div>
  @if($contract->type === 'indeterminado')
  <p>
    O presente contrato é celebrado por <span class="highlight">prazo indeterminado</span>,
    com início em <span class="highlight">{{ $startDate }}</span>, nos termos do artigo 37.º da LGT.
  </p>
  <p>
    O período experimental é de <strong>60 (sessenta) dias</strong>, nos termos do artigo 47.º da LGT,
    durante o qual qualquer das partes pode resolver o contrato sem aviso prévio nem indemnização.
  </p>
  @elseif($contract->type === 'prazo_certo')
  <p>
    O presente contrato é celebrado a <span class="highlight">prazo certo</span>,
    com início em <span class="highlight">{{ $startDate }}</span>
    @if($contract->end_date)
      e termo em <span class="highlight">{{ $endDate }}</span>
    @endif
    , nos termos do artigo 38.º da LGT.
  </p>
  <p>
    O contrato renova-se automaticamente por igual período caso não seja denunciado por qualquer das partes com antecedência mínima de 30 dias, ao abrigo do artigo 42.º da LGT.
  </p>
  @else
  <p>
    O presente contrato de <span class="highlight">prestação de serviços</span> tem início em
    <span class="highlight">{{ $startDate }}</span>
    @if($contract->end_date)
      e término previsto em <span class="highlight">{{ $endDate }}</span>
    @endif
    , nos termos do artigo 44.º da LGT.
  </p>
  @endif

  <hr class="divider">

  {{-- Cláusula 4 — Remuneração --}}
  <div class="section-title">Cláusula 4.ª — Remuneração</div>
  <p>
    Pela prestação dos seus serviços, o trabalhador receberá a seguinte retribuição mensal, nos termos do artigo 106.º da LGT:
  </p>
  <table class="parties-table" style="margin-top:6px">
    <tr>
      <td class="label">Salário base:</td>
      <td><strong>{{ $fmt($contract->base_salary) }} {{ $currency }}</strong></td>
    </tr>
    @if((float)$contract->food_allowance > 0)
    <tr>
      <td class="label">Subsídio de alimentação:</td>
      <td>{{ $fmt($contract->food_allowance) }} {{ $currency }}</td>
    </tr>
    @endif
    @if((float)$contract->transport_allowance > 0)
    <tr>
      <td class="label">Subsídio de transporte:</td>
      <td>{{ $fmt($contract->transport_allowance) }} {{ $currency }}</td>
    </tr>
    @endif
    <tr>
      <td class="label" style="padding-top:6px"><strong>Remuneração total:</strong></td>
      <td style="padding-top:6px"><strong class="highlight">{{ $fmt($totalSalary) }} {{ $currency }}</strong></td>
    </tr>
  </table>
  <p style="margin-top:6px">
    O pagamento será efectuado até ao último dia útil de cada mês, por transferência bancária
    @if($employee->iban) para o IBAN <strong>{{ $employee->iban }}</strong>@endif.
  </p>

  <hr class="divider">

  {{-- Cláusula 5 — Descontos --}}
  <div class="section-title">Cláusula 5.ª — Descontos Obrigatórios</div>
  <p>
    Sobre a remuneração bruta mensal serão efectuados os seguintes descontos obrigatórios por lei:
  </p>
  <table class="parties-table" style="margin-top:6px">
    <tr>
      <td class="label">INSS (trabalhador):</td>
      <td><strong>3%</strong> sobre o salário base — ao abrigo do Decreto Legislativo Presidencial n.º 1/20, de 7 de Janeiro</td>
    </tr>
    <tr>
      <td class="label">INSS (empregador):</td>
      <td><strong>8%</strong> sobre o salário base — contribuição a cargo da entidade empregadora</td>
    </tr>
    <tr>
      <td class="label">IRT:</td>
      <td>Calculado sobre o rendimento colectável de acordo com a tabela progressiva do <strong>Código do IRT — Lei n.º 26/20, de 20 de Julho</strong></td>
    </tr>
  </table>
  <p style="margin-top:6px">
    O valor líquido a receber pelo trabalhador corresponde à remuneração total deduzida do INSS (3%) e do IRT calculado
    nos termos da tabela em vigor, sendo o empregador responsável pela entrega das contribuições às entidades competentes.
  </p>
  @if((float)$inssWorker > 0 || (float)$irt > 0)
  <table class="parties-table" style="margin-top:8px">
    @if((float)$inssWorker > 0)
    <tr>
      <td class="label">INSS estimado (3%):</td>
      <td>{{ $fmt($inssWorker) }} {{ $currency }}</td>
    </tr>
    @endif
    @if((float)$irt > 0)
    <tr>
      <td class="label">IRT estimado:</td>
      <td>{{ $fmt($irt) }} {{ $currency }}</td>
    </tr>
    @endif
    <tr>
      <td class="label" style="padding-top:6px"><strong>Salário líquido estimado:</strong></td>
      <td style="padding-top:6px"><strong class="highlight">{{ $fmt($netSalary) }} {{ $currency }}</strong></td>
    </tr>
  </table>
  <p style="font-size:9px;color:#9ca3af;margin-top:4px">* Valores estimados com base na tabela de IRT vigente. O valor definitivo pode variar.</p>
  @endif

  <hr class="divider">

  {{-- Cláusula 7 — Horário de Trabalho --}}
  <div class="section-title">Cláusula 7.ª — Horário de Trabalho</div>
  <p>
    O trabalhador está sujeito ao horário normal de trabalho de <strong>8 (oito) horas diárias</strong>
    e <strong>44 (quarenta e quatro) horas semanais</strong>, nos termos do artigo 96.º da LGT,
    podendo ser alterado por acordo escrito entre as partes, respeitando os limites legais.
  </p>

  <hr class="divider">

  {{-- Cláusula 8 — Férias e Faltas --}}
  <div class="section-title">Cláusula 8.ª — Férias, Faltas e Licenças</div>
  <p>
    O trabalhador tem direito a <strong>22 (vinte e dois) dias úteis de férias anuais</strong>
    remuneradas, nos termos do artigo 198.º da LGT, adquirindo-se esse direito após 12 meses de serviço efectivo.
    As férias serão marcadas por acordo entre as partes, tendo em conta as necessidades do serviço.
  </p>
  <p>
    As faltas ao trabalho, justificadas e injustificadas, regem-se pelo disposto nos artigos 157.º a 170.º da LGT.
  </p>

  <hr class="divider">

  {{-- Cláusula 9 — Deveres das Partes --}}
  <div class="section-title">Cláusula 9.ª — Deveres do Trabalhador</div>
  <p>Nos termos do artigo 72.º da LGT, o trabalhador obriga-se a:</p>
  <p style="margin-left:12px">
    <strong>a)</strong> Executar com zelo, diligência e competência o trabalho contratado;<br>
    <strong>b)</strong> Cumprir as ordens e instruções da entidade empregadora, salvo as que atentem contra os seus direitos ou garantias;<br>
    <strong>c)</strong> Guardar lealdade à entidade empregadora, nomeadamente não divulgando informações referentes à organização, aos métodos de produção ou aos negócios da empresa;<br>
    <strong>d)</strong> Zelar pela conservação e boa utilização dos bens e equipamentos confiados pela entidade empregadora;<br>
    <strong>e)</strong> Respeitar e tratar com urbanidade e probidade a entidade empregadora, os superiores hierárquicos, os companheiros de trabalho e demais pessoas que estejam ou entrem em relação com a empresa;<br>
    <strong>f)</strong> Promover ou executar os actos tendentes à melhoria da produtividade da empresa;<br>
    <strong>g)</strong> Comparecer ao trabalho com regularidade e pontualidade.
  </p>

  <hr class="divider">

  {{-- Cláusula 10 — Faltas e Atrasos --}}
  <div class="section-title">Cláusula 10.ª — Faltas e Atrasos</div>
  <p><strong>Faltas justificadas</strong> — São consideradas justificadas, nos termos do artigo 159.º da LGT, as faltas motivadas por:</p>
  <p style="margin-left:12px">
    <strong>a)</strong> Doença ou acidente do trabalhador, devidamente comprovados por atestado médico;<br>
    <strong>b)</strong> Falecimento de cônjuge, filho, pai, mãe ou outro familiar a cargo do trabalhador;<br>
    <strong>c)</strong> Casamento do trabalhador (até 5 dias úteis);<br>
    <strong>d)</strong> Nascimento de filho (até 3 dias úteis para o pai);<br>
    <strong>e)</strong> Cumprimento de obrigações legais ou participação em actos processuais;<br>
    <strong>f)</strong> Autorização prévia concedida pela entidade empregadora.
  </p>
  <p style="margin-top:6px">
    As faltas justificadas não determinam perda de retribuição, salvo as previstas nas alíneas f) e outras expressamente ressalvadas por lei.
  </p>

  <p style="margin-top:8px"><strong>Faltas injustificadas</strong> — As faltas não previstas no artigo 159.º da LGT são consideradas injustificadas, nos termos do artigo 160.º da LGT, e implicam:</p>
  <p style="margin-left:12px">
    <strong>a)</strong> Perda proporcional da retribuição correspondente ao período de ausência;<br>
    <strong>b)</strong> Não contagem do tempo de ausência para efeitos de antiguidade;<br>
    <strong>c)</strong> Eventual instauração de processo disciplinar, nos termos da cláusula seguinte.
  </p>

  <p style="margin-top:8px"><strong>Atrasos</strong> — Nos termos do artigo 163.º da LGT, os atrasos ao início do período de trabalho ou as saídas antecipadas:</p>
  <p style="margin-left:12px">
    <strong>a)</strong> Determinam desconto proporcional na remuneração pelo tempo não trabalhado;<br>
    <strong>b)</strong> A reincidência de atrasos injustificados pode constituir infracção disciplinar sujeita a sanção, nos termos do regulamento interno da empresa.
  </p>

  <hr class="divider">

  {{-- Cláusula 11 — Processo Disciplinar --}}
  <div class="section-title">Cláusula 11.ª — Poder e Processo Disciplinar</div>
  <p>
    A entidade empregadora detém poder disciplinar sobre o trabalhador ao seu serviço, nos termos do artigo 76.º, n.º 1, alínea e), e artigos 213.º a 230.º da LGT.
  </p>
  <p style="margin-top:6px"><strong>Sanções disciplinares aplicáveis</strong> (art. 214.º da LGT):</p>
  <p style="margin-left:12px">
    <strong>a)</strong> Advertência verbal;<br>
    <strong>b)</strong> Advertência escrita;<br>
    <strong>c)</strong> Suspensão do trabalho com perda de retribuição e de antiguidade até 30 dias por infracção;<br>
    <strong>d)</strong> Despedimento com justa causa.
  </p>
  <p style="margin-top:6px">
    Constituem justa causa de despedimento, nos termos do artigo 206.º da LGT, nomeadamente: a desobediência ilegítima às ordens dos superiores hierárquicos; a violação de direitos e garantias de outros trabalhadores; a provocação de conflitos; a prática de actos lesivos dos interesses da empresa; a condenação por crimes dolosos; e a ausência injustificada por mais de <strong>7 (sete) dias consecutivos</strong> ou <strong>15 (quinze) dias interpolados</strong> no período de 12 meses.
  </p>
  <p style="margin-top:6px">
    Nenhuma sanção disciplinar pode ser aplicada sem que ao trabalhador seja concedido o direito de audiência e defesa prévia, através de nota de culpa escrita, dispondo de <strong>10 (dez) dias úteis</strong> para resposta, nos termos do artigo 219.º da LGT.
  </p>

  @if($contract->notes)
  <hr class="divider">
  <div class="section-title">Cláusula 12.ª — Disposições Especiais</div>
  <p>{{ $contract->notes }}</p>
  @endif

  <hr class="divider">

  {{-- Cláusula — Legislação Aplicável --}}
  <div class="section-title">Disposições Finais</div>
  <p>
    O presente contrato é regido pela Lei Geral do Trabalho — <strong>Lei n.º 7/15, de 15 de Junho de 2015</strong>,
    e demais legislação laboral angolana aplicável.
    Para resolução de conflitos emergentes do presente contrato, as partes elegem o Tribunal do Trabalho competente,
    em conformidade com o artigo 320.º da LGT.
  </p>
  <p>
    O presente contrato é celebrado em <strong>duplicado</strong>, ficando cada uma das partes com um exemplar
    com igual valor probatório.
  </p>
  <p style="margin-top:8px">
    <strong>{{ $company->address ?: 'Angola' }}, aos {{ $generatedAt }}</strong>
  </p>

  {{-- Assinaturas --}}
  <div class="sign">
    <table>
      <tr>
        <td>
          @if($companySignatureData)
            <div><img src="{{ $companySignatureData }}" class="sig-img" alt="assinatura"></div>
          @endif
          <div class="line">
            A Entidade Empregadora<br>
            <span style="font-size:9px;color:#6b7280">{{ $company->name }}</span>
          </div>
        </td>
        <td>
          @if(!empty($employeeSignatureData))
            <div style="margin-bottom:4px;text-align:center;">
              <img src="{{ $employeeSignatureData }}" class="sig-img" alt="assinatura trabalhador">
            </div>
          @endif
          <div class="line">
            O Trabalhador<br>
            <span style="font-size:9px;color:#6b7280">{{ $employee->full_name }}</span>
            @if(!empty($signedAt))
              <br><span style="font-size:9px;color:#6b7280">Assinado em {{ $signedAt }}</span>
            @endif
          </div>
        </td>
      </tr>
    </table>
  </div>

  <div class="footer">
    Documento gerado por RHadmin em {{ $generatedAt }} &nbsp;·&nbsp;
    Ao abrigo da Lei n.º 7/15 — Lei Geral do Trabalho de Angola
  </div>
</div>
</body>
</html>
