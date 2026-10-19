/*
  O que acontece quando se clica. O HTML fica no index, o ecrã no tela.js.
  点击之后做什么。HTML 在 index，画面在 tela.js。
  What happens on a click. HTML stays in index, the screen stays in tela.js.
*/

// Lê um campo do formulário. | 读取表单字段。 | Reads one form field.
function valorForm(form, nome) {
  const campo = form.elements[nome];
  if (!campo) return "";
  if (campo.type === "checkbox") return campo.checked;
  return campo.value.trim();
}

// Junta os campos do cliente para enviar à API. | 拼好客户字段发给接口。 | Builds the customer fields sent to the API.
function clienteDoForm(form) {
  return {
    codigo: valorForm(form, "codigo"),
    nome: valorForm(form, "nome"),
    nif: valorForm(form, "nif"),
    morada: valorForm(form, "morada"),
    localidade: valorForm(form, "localidade"),
    codigoPostal: valorForm(form, "codigoPostal"),
    telefone: valorForm(form, "telefone"),
    email: valorForm(form, "email"),
    pessoaSingular: Boolean(valorForm(form, "pessoaSingular"))
  };
}

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

// Confirma que a API responde e mostra a moeda. | 确认接口在线并显示币种。 | Checks that the API answers and shows the currency.
async function ligar() {
  const estado = document.querySelector("#estadoApi");
  estado.textContent = "a ligar";
  estado.className = "pill";
  try {
    const health = await AlphaApi.health();
    Tela.setMoeda(health.moeda || "", health.precoComIva);
    estado.textContent = health.empresa + " ligado";
    estado.classList.add("ok");
    return health;
  } catch (err) {
    estado.textContent = "sem ligação";
    estado.classList.add("erro");
    Tela.toast(err.message);
  }
}

// Ao sair do código, puxa descrição e preço se o artigo já existir. | 离开代码框时，如果物料已存在就带出描述和价格。 | On leaving the code, fills description and price when the article already exists.
async function aoMudarArtigo(tr, codigo) {
  try {
    const artigo = await AlphaApi.artigo(codigo);
    tr.querySelector(".descricao").value = artigo.descricao || "";
    tr.querySelector(".civa").value = artigo.codIva || "";
    if (!Number(tr.querySelector(".preco").value)) tr.querySelector(".preco").value = artigo.preco || 0;
    Tela.atualizarTotal();
  } catch (err) {
    Tela.toast(err.message);
  }
}

// Envia a fatura. O artigo já tem de existir. O cliente em falta é criado antes. | 提交发票。物料必须已存在。缺客户时先创建。 | Sends the invoice. The article must already exist. A missing customer is created first.
async function emitir(event) {
  event.preventDefault();
  const form = event.target;
  const linhas = Tela.lerLinhas();
  if (!linhas.length) {
    Tela.toast("Indique pelo menos um artigo.");
    return;
  }

  const tipoDoc = valorForm(form, "tipoDoc");
  const modoPag = valorForm(form, "modoPag");
  if (!tipoDoc) {
    Tela.toast("Indique o tipo de documento.");
    return;
  }
  if (!modoPag) {
    Tela.toast("Indique a forma de pagamento.");
    return;
  }

  const botao = document.querySelector("#btnEmitir");
  botao.disabled = true;
  try {
    const pedido = {
      ordemServico: valorForm(form, "ordemServico"),
      data: valorForm(form, "data") || null,
      observacoes: valorForm(form, "observacoes"),
      iniciarDownload: document.querySelector("#iniciarDownload").checked,
      cliente: clienteDoForm(form),
      linhas: linhas
    };
    const resposta = await AlphaApi.emitir(tipoDoc, modoPag, pedido);
    mostrarFaturaEmitida(resposta);
  } catch (err) {
    Tela.toast(err.message);
  } finally {
    botao.disabled = false;
  }
}

function mostrarFaturaEmitida(resposta) {
  if (resposta && resposta.pdf) {
    AlphaApi.descarregar(resposta.pdf, resposta.nome);
    const info = resposta.cabecalhos;
    Tela.mostrarResultado("resultadoFatura", info.jaExistia ? "Fatura já existente" : "Fatura emitida", [
      ["Referência", info.referencia],
      ["Cliente", info.cliente],
      ["Cliente criado", info.clienteCriado ? "sim" : "não"],
      ["Total", info.total],
      ["Ordem", info.ordemServico],
      ["PDF", resposta.nome]
    ]);
    Tela.toast("Download de " + resposta.nome + " iniciado.");
    return;
  }

  if (resposta && resposta.fatura) {
    const codigo = resposta.cliente && resposta.cliente.codigo;
    Tela.mostrarResultado("resultadoFatura", resposta.jaExistia ? "Fatura já existente" : "Fatura emitida", [
      ["Referência", resposta.fatura.referencia],
      ["Cliente", codigo],
      ["Cliente criado", resposta.clienteCriado ? "sim" : "não"],
      ["Total", Tela.dinheiro(resposta.fatura.totalDocumento)],
      ["Download", resposta.fatura.urlDownload]
    ]);
    Tela.toast("Fatura " + resposta.fatura.referencia + " gravada.");
  }
}

async function verFatura(f) {
  try {
    const detalhe = await AlphaApi.detalhe(f.tipoDoc, f.referencia);
    const linhas = (detalhe.linhas || []).map(function (l) {
      return l.artigo + " · " + l.descricao + " · " + l.quantidade + " x " + Tela.dinheiro(l.precoUnitario);
    }).join(" | ");
    Tela.mostrarResultado("detalheFatura", detalhe.referencia, [
      ["Data", detalhe.data],
      ["Cliente", detalhe.nome + " (" + detalhe.entidade + ")"],
      ["NIF", detalhe.nif],
      ["Estado", detalhe.estado],
      ["Total", Tela.dinheiro(detalhe.totalDocumento)],
      ["IVA", Tela.dinheiro(detalhe.totalIva)],
      ["Linhas", linhas]
    ]);
  } catch (err) {
    Tela.toast(err.message);
  }
}

async function baixarPdf(f) {
  try {
    const ficheiro = await AlphaApi.pdf(f.tipoDoc, f.referencia);
    AlphaApi.descarregar(ficheiro.pdf, ficheiro.nome);
    Tela.toast("Download de " + ficheiro.nome + " iniciado.");
  } catch (err) {
    Tela.toast(err.message);
  }
}

async function anularFatura(f) {
  if (!confirm("Anular a fatura " + f.referencia + "?")) return;
  try {
    await AlphaApi.anular(f.tipoDoc, {
      referencia: f.referencia,
      motivo: "",
      observacoes: "Anulada pela aplicação FaturarAPI"
    });
    Tela.toast(f.referencia + " anulada.");
    document.querySelector("#formLista").requestSubmit();
  } catch (err) {
    Tela.toast(err.message);
  }
}

function cartaoCliente(cliente, criado) {
  const morada = [cliente.morada, cliente.localidade].filter(Boolean).join(", ");
  Tela.mostrarResultado("cartaoCliente", criado ? "Cliente criado" : "Cliente encontrado", [
    ["Código", cliente.codigo],
    ["Nome", cliente.nome],
    ["NIF", cliente.nif],
    ["Morada", morada],
    ["Telefone", cliente.telefone],
    ["Email", cliente.email]
  ]);
}

// Põe o artigo pesquisado na fatura que está aberta. | 把查到的物料放进正在开的发票。 | Puts the found article on the invoice being prepared.
async function usarArtigo(a) {
  let preco = a.preco || 0;
  let codIva = a.codIva || "";
  try {
    const completo = await AlphaApi.artigo(a.codigo);
    preco = completo.preco || preco;
    codIva = completo.codIva || codIva;
  } catch (err) {
    preco = a.preco || 0;
  }
  Tela.adicionarLinha({
    artigo: a.codigo,
    descricao: a.descricao,
    quantidade: 1,
    precoUnitario: preco,
    desconto: 0,
    codIva: codIva
  });
  Tela.mostrar("faturar");
  Tela.toast(a.codigo + " adicionado à fatura.");
}

function iniciar() {
  Tela.acoes.mudaArtigo = aoMudarArtigo;
  Tela.acoes.verFatura = verFatura;
  Tela.acoes.pdfFatura = baixarPdf;
  Tela.acoes.anularFatura = anularFatura;
  Tela.acoes.usarArtigo = usarArtigo;

  document.querySelector("#formFatura").elements.data.value = hoje();
  Tela.adicionarLinha();

  document.querySelectorAll(".nav-btn").forEach(function (b) {
    b.addEventListener("click", function () { Tela.mostrar(b.dataset.view); });
  });
  document.querySelector("#btnLinha").addEventListener("click", function () { Tela.adicionarLinha(); });
  document.querySelector("#formFatura").addEventListener("submit", emitir);

  document.querySelector("#btnNif").addEventListener("click", async function () {
    const nif = document.querySelector("#formFatura").elements.nif.value.trim();
    if (!nif) return;
    try {
      const cliente = await AlphaApi.clientePorNif(nif);
      Tela.preencherCliente(cliente);
    } catch (err) {
      Tela.avisoCliente("NIF ainda não existe. Será criado ao emitir a fatura.");
      Tela.toast(err.message);
    }
  });

  document.querySelector("#formLista").addEventListener("submit", async function (ev) {
    ev.preventDefault();
    const form = ev.target;
    const query = {};
    ["tipoDoc", "nif", "codigo", "dataInicio", "dataFim"].forEach(function (nome) {
      const valor = valorForm(form, nome);
      if (valor) query[nome] = valor;
    });
    try {
      Tela.renderFaturas(await AlphaApi.listarFaturas(query));
    } catch (err) {
      Tela.toast(err.message);
    }
  });

  document.querySelector("#formProcuraCliente").addEventListener("submit", async function (ev) {
    ev.preventDefault();
    const nif = valorForm(ev.target, "nif");
    const codigo = valorForm(ev.target, "codigo");
    try {
      const cliente = nif ? await AlphaApi.clientePorNif(nif) : await AlphaApi.clientePorCodigo(codigo);
      cartaoCliente(cliente, false);
    } catch (err) {
      Tela.toast(err.message);
    }
  });

  document.querySelector("#formNovoCliente").addEventListener("submit", async function (ev) {
    ev.preventDefault();
    try {
      const resposta = await AlphaApi.garantirCliente(clienteDoForm(ev.target));
      cartaoCliente(resposta.cliente, resposta.criado);
      Tela.toast(resposta.criado ? "Cliente criado no Primavera." : "Cliente já existia e foi reutilizado.");
    } catch (err) {
      Tela.toast(err.message);
    }
  });

  document.querySelector("#formArtigos").addEventListener("submit", async function (ev) {
    ev.preventDefault();
    try {
      Tela.renderArtigos(await AlphaApi.artigos(valorForm(ev.target, "pesquisa")));
    } catch (err) {
      Tela.toast(err.message);
    }
  });

  AlphaApi.carregar().then(ligar).catch(function (err) {
    const estado = document.querySelector("#estadoApi");
    estado.textContent = "sem config";
    estado.className = "pill erro";
    Tela.toast(err.message);
  });
}

iniciar();
