/*
  O que se vê no ecrã. Não chama a API.
  只负责画面，不调用接口。
  What shows on the screen. This file does not call the API.
*/
const Tela = (function () {
  let moeda = "";
  let comIva = true;
  const linhasBody = document.querySelector("#linhas");

  // Funções que o app.js liga aos botões. | app.js 接到按钮上的函数。 | Functions app.js attaches to the buttons.
  const acoes = {
    mudaArtigo: null,
    verFatura: null,
    pdfFatura: null,
    anularFatura: null,
    usarArtigo: null
  };

  function $(sel) {
    return document.querySelector(sel);
  }

  // Copia um modelo do HTML. | 复制 HTML 里的模板。 | Copies a template from the HTML.
  function copiar(id) {
    return document.getElementById(id).content.cloneNode(true);
  }

  // Aviso curto no canto. | 角落里的短提示。 | Short notice in the corner.
  function toast(mensagem) {
    const el = $("#toast");
    el.textContent = mensagem;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.remove("show"); }, 4200);
  }

  // Número com a moeda da empresa, quando já sabemos qual é. | 知道公司币种后，数字后面带上币种。 | Number plus the company currency, once we know it.
  function dinheiro(valor) {
    const numero = Number(valor || 0);
    const texto = numero.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return moeda ? texto + " " + moeda : texto;
  }

  function setMoeda(valor, precoComIva) {
    moeda = valor || "";
    comIva = precoComIva !== false;
    atualizarTotal();
  }

  // Muda de página no menu. | 切换菜单页面。 | Switches the page in the menu.
  function mostrar(id) {
    document.querySelectorAll(".view").forEach(function (v) { v.classList.remove("active"); });
    document.querySelectorAll(".nav-btn").forEach(function (b) {
      b.classList.toggle("active", b.dataset.view === id);
    });
    $("#view-" + id).classList.add("active");
  }

  function lerLinhas() {
    return Array.from(linhasBody.querySelectorAll("tr")).map(function (tr) {
      return {
        artigo: tr.querySelector(".artigo").value.trim(),
        descricao: tr.querySelector(".descricao").value.trim(),
        quantidade: Number(tr.querySelector(".quantidade").value),
        precoUnitario: Number(tr.querySelector(".preco").value),
        desconto: Number(tr.querySelector(".desconto").value || 0),
        codIva: tr.querySelector(".civa").value.trim()
      };
    }).filter(function (l) { return l.artigo; });
  }

  // Soma quantidade x preço, menos o desconto. | 数量乘单价，再减折扣。 | Quantity times price, minus the discount.
  function atualizarTotal() {
    const total = lerLinhas().reduce(function (soma, linha) {
      const bruto = linha.quantidade * linha.precoUnitario;
      return soma + bruto * (1 - (linha.desconto || 0) / 100);
    }, 0);
    const rotulo = comIva ? "Total com IVA " : "Total ";
    $("#totalEstimado").textContent = rotulo + dinheiro(total);
  }

  // Acrescenta uma linha a partir do modelo. | 用模板加一行。 | Adds a row from the template.
  function adicionarLinha(dados) {
    const d = dados || {};
    const frag = copiar("tpl-linha");
    const tr = frag.querySelector("tr");
    tr.querySelector(".artigo").value = d.artigo || "";
    tr.querySelector(".descricao").value = d.descricao || "";
    tr.querySelector(".quantidade").value = d.quantidade || 1;
    tr.querySelector(".preco").value = d.precoUnitario || 0;
    tr.querySelector(".desconto").value = d.desconto || 0;
    tr.querySelector(".civa").value = d.codIva || "";

    tr.querySelector(".artigo").addEventListener("change", function (ev) {
      const codigo = ev.target.value.trim();
      if (codigo && acoes.mudaArtigo) acoes.mudaArtigo(tr, codigo);
    });
    tr.querySelector(".remover").addEventListener("click", function () {
      if (linhasBody.children.length === 1) return;
      tr.remove();
      atualizarTotal();
    });
    tr.querySelectorAll("input").forEach(function (input) {
      input.addEventListener("input", atualizarTotal);
    });

    linhasBody.appendChild(tr);
    atualizarTotal();
    return tr;
  }

  function preencherCliente(cliente) {
    const form = $("#formFatura");
    form.elements.codigo.value = cliente.codigo || "";
    form.elements.nome.value = cliente.nome || "";
    form.elements.nif.value = cliente.nif || "";
    form.elements.morada.value = cliente.morada || "";
    form.elements.localidade.value = cliente.localidade || "";
    form.elements.codigoPostal.value = cliente.codigoPostal || "";
    form.elements.telefone.value = cliente.telefone || "";
    form.elements.email.value = cliente.email || "";
    $("#avisoCliente").textContent = "Cliente " + cliente.codigo + " já existe no Primavera e será reutilizado.";
  }

  function avisoCliente(texto) {
    $("#avisoCliente").textContent = texto;
  }

  // Título e lista de pares, sem montar HTML à mão. | 标题和字段列表，不用手写 HTML。 | Title and field list, without hand-built HTML.
  function mostrarResultado(id, titulo, pares) {
    const el = document.getElementById(id);
    el.classList.remove("hidden");
    el.querySelector("h2").textContent = titulo;
    const dl = el.querySelector("dl");
    dl.innerHTML = "";
    pares.forEach(function (par) {
      const frag = copiar("tpl-par");
      frag.querySelector("dt").textContent = par[0];
      frag.querySelector("dd").textContent = par[1] == null ? "" : String(par[1]);
      dl.appendChild(frag);
    });
  }

  function linhaVazia(corpo, colunas, texto) {
    corpo.innerHTML = "";
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = colunas;
    td.className = "empty";
    td.textContent = texto;
    tr.appendChild(td);
    corpo.appendChild(tr);
  }

  function renderFaturas(lista) {
    const corpo = $("#tabelaFaturas");
    if (!lista.length) {
      linhaVazia(corpo, 7, "Nenhuma fatura encontrada.");
      return;
    }
    corpo.innerHTML = "";
    lista.forEach(function (f) {
      const frag = copiar("tpl-fatura");
      const tr = frag.querySelector("tr");
      tr.querySelector(".ref").textContent = f.referencia || "";
      tr.querySelector(".data").textContent = f.data || "";
      tr.querySelector(".nome").textContent = f.nome || "";
      tr.querySelector(".nif").textContent = f.nif || "";
      tr.querySelector(".os").textContent = f.ordemServico || "";
      tr.querySelector(".total").textContent = dinheiro(f.totalDocumento);
      const estado = tr.querySelector(".estado");
      estado.textContent = f.estado || "";
      if (f.estado === "ANULADO") estado.classList.add("off");
      tr.querySelector(".ver").addEventListener("click", function () {
        if (acoes.verFatura) acoes.verFatura(f);
      });
      tr.querySelector(".pdf").addEventListener("click", function () {
        if (acoes.pdfFatura) acoes.pdfFatura(f);
      });
      tr.querySelector(".anular").addEventListener("click", function () {
        if (acoes.anularFatura) acoes.anularFatura(f);
      });
      corpo.appendChild(tr);
    });
  }

  function renderArtigos(lista) {
    const corpo = $("#tabelaArtigos");
    if (!lista.length) {
      linhaVazia(corpo, 5, "Nenhum artigo encontrado.");
      return;
    }
    corpo.innerHTML = "";
    lista.forEach(function (a) {
      const frag = copiar("tpl-artigo");
      const tr = frag.querySelector("tr");
      tr.querySelector(".codigo").textContent = a.codigo || "";
      tr.querySelector(".descricao").textContent = a.descricao || "";
      tr.querySelector(".unidade").textContent = a.unidade || "";
      tr.querySelector(".iva").textContent = a.codIva || "";
      tr.querySelector(".usar").addEventListener("click", function () {
        if (acoes.usarArtigo) acoes.usarArtigo(a);
      });
      corpo.appendChild(tr);
    });
  }

  return {
    acoes: acoes,
    toast: toast,
    dinheiro: dinheiro,
    setMoeda: setMoeda,
    mostrar: mostrar,
    lerLinhas: lerLinhas,
    atualizarTotal: atualizarTotal,
    adicionarLinha: adicionarLinha,
    preencherCliente: preencherCliente,
    avisoCliente: avisoCliente,
    mostrarResultado: mostrarResultado,
    renderFaturas: renderFaturas,
    renderArtigos: renderArtigos
  };
})();
