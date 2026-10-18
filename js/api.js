/*
  Chamadas à API. Não mexe no ecrã.
  只调用接口，不改界面。
  API calls only. This file does not touch the screen.
*/
const AlphaApi = (function () {
  const segredoLocal = "FaturarAPI.local.v1";
  let endereco = "http://localhost:50738";
  let chavePlana = "";

  // Endereço lido do config.json. | 从 config.json 读取的地址。 | Address read from config.json.
  function base() {
    return endereco;
  }

  function apiKey() {
    return chavePlana;
  }

  // A mesma frase que o gravar-config.cmd usa para cifrar. | 与 gravar-config.cmd 相同的加密口令。 | Same phrase gravar-config.cmd uses to encrypt.
  async function chaveAes() {
    const bruto = new TextEncoder().encode((segredoLocal + "00000000000000000000000000000000").slice(0, 32));
    return crypto.subtle.importKey("raw", bruto, "AES-CBC", false, ["decrypt"]);
  }

  function deBase64(texto) {
    const binario = atob(texto);
    const bytes = new Uint8Array(binario.length);
    for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
    return bytes;
  }

  async function decifrar(pacote) {
    const bytes = deBase64(pacote.slice(4));
    const chave = await chaveAes();
    const plano = await crypto.subtle.decrypt(
      { name: "AES-CBC", iv: bytes.slice(0, 16) },
      chave,
      bytes.slice(16)
    );
    return new TextDecoder().decode(plano);
  }

  // Lê config.json e, se houver chave, abre o valor enc:. | 读取 config.json，有密钥时解开 enc:。 | Reads config.json and, when present, opens the enc: value.
  async function carregar() {
    const resposta = await fetch("config.json", { cache: "no-store" });
    if (!resposta.ok) throw new Error("Não encontrei config.json.");
    const config = await resposta.json();
    endereco = String(config.apiBase || endereco).replace(/\/$/, "");
    const guardada = String(config.apiKey || "");
    if (!guardada) {
      chavePlana = "";
      return "";
    }
    if (guardada.indexOf("enc:") !== 0)
      throw new Error("A apiKey em config.json tem de começar por enc:.");
    chavePlana = await decifrar(guardada);
    return chavePlana;
  }

  function headers(json) {
    const h = {};
    if (json) h["Content-Type"] = "application/json";
    if (chavePlana) h["X-Api-Key"] = chavePlana;
    return h;
  }

  // A API devolve a mensagem em "message". | 接口错误在 message 字段。 | The API puts the error text in "message".
  async function lerErro(resposta) {
    try {
      const corpo = await resposta.json();
      return corpo.message || corpo.mensagem || resposta.statusText;
    } catch (err) {
      return resposta.statusText || "Erro na API";
    }
  }

  // Um pedido. PDF volta como ficheiro, o resto como JSON. | 一次请求。PDF 当文件返回，其余是 JSON。 | One request. A PDF comes back as a file, everything else as JSON.
  async function pedido(caminho, opcoes) {
    const resposta = await fetch(base() + caminho, {
      method: opcoes.method || "GET",
      headers: headers(Boolean(opcoes.body)),
      body: opcoes.body ? JSON.stringify(opcoes.body) : undefined
    });

    const tipo = resposta.headers.get("content-type") || "";
    if (tipo.indexOf("application/pdf") >= 0) {
      if (!resposta.ok) throw new Error(await lerErro(resposta));
      return {
        pdf: await resposta.blob(),
        nome: nomeFicheiro(resposta),
        cabecalhos: cabecalhosFatura(resposta)
      };
    }

    if (resposta.status === 204) return null;
    const dados = tipo.indexOf("json") >= 0 ? await resposta.json() : null;
    if (!resposta.ok) {
      const texto = dados && (dados.message || dados.mensagem);
      throw new Error(texto || resposta.statusText);
    }
    return dados;
  }

  function nomeFicheiro(resposta) {
    const disp = resposta.headers.get("content-disposition") || "";
    const match = /filename="?([^";]+)"?/i.exec(disp);
    return match ? match[1] : "fatura.pdf";
  }

  // Dados que a API manda nos cabeçalhos do PDF. | PDF 响应头里的发票信息。 | Invoice facts sent in the PDF headers.
  function cabecalhosFatura(resposta) {
    return {
      referencia: resposta.headers.get("X-Fatura-Referencia"),
      total: resposta.headers.get("X-Fatura-Total"),
      cliente: resposta.headers.get("X-Cliente-Codigo"),
      clienteCriado: resposta.headers.get("X-Cliente-Criado") === "true",
      jaExistia: resposta.headers.get("X-Fatura-Ja-Existia") === "true",
      ordemServico: resposta.headers.get("X-Ordem-Servico")
    };
  }

  // Dispara o download no browser. | 在浏览器里触发下载。 | Starts the download in the browser.
  function descarregar(blob, nome) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = nome || "fatura.pdf";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  return {
    base: base,
    apiKey: apiKey,
    carregar: carregar,
    health: function () { return pedido("/api/health", {}); },
    emitir: function (tipoDoc, modoPag, corpo) {
      const caminho = "/api/faturas?tipoDoc=" + encodeURIComponent(tipoDoc) + "&modoPag=" + encodeURIComponent(modoPag);
      return pedido(caminho, { method: "POST", body: corpo });
    },
    listarFaturas: function (query) { return pedido("/api/faturas?" + new URLSearchParams(query), {}); },
    detalhe: function (tipoDoc, referencia) {
      const caminho = "/api/faturas/por-referencia?tipoDoc=" + encodeURIComponent(tipoDoc) + "&referencia=" + encodeURIComponent(referencia);
      return pedido(caminho, {});
    },
    pdf: function (tipoDoc, referencia) {
      const caminho = "/api/faturas/pdf?tipoDoc=" + encodeURIComponent(tipoDoc) + "&referencia=" + encodeURIComponent(referencia);
      return pedido(caminho, {});
    },
    anular: function (tipoDoc, corpo) {
      return pedido("/api/faturas/anular?tipoDoc=" + encodeURIComponent(tipoDoc), { method: "POST", body: corpo });
    },
    clientePorNif: function (nif) { return pedido("/api/clientes/por-nif?nif=" + encodeURIComponent(nif), {}); },
    clientePorCodigo: function (codigo) { return pedido("/api/clientes/" + encodeURIComponent(codigo), {}); },
    garantirCliente: function (corpo) { return pedido("/api/clientes", { method: "POST", body: corpo }); },
    artigos: function (pesquisa) { return pedido("/api/artigos?pesquisa=" + encodeURIComponent(pesquisa || ""), {}); },
    artigo: function (codigo) { return pedido("/api/artigos/" + encodeURIComponent(codigo), {}); },
    descarregar: descarregar
  };
})();
