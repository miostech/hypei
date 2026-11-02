-- A capa do produto deixa de ser URL colada e passa a ser arquivo enviado pelo produtor,
-- guardado como chave de objeto no storage. Não dá para converter um valor no outro: uma URL
-- externa não é uma chave, então a coluna antiga sai em vez de ser renomeada. Quem tinha capa
-- precisa enviar a imagem de novo.
ALTER TABLE "Product" DROP COLUMN "thumbnailUrl",
ADD COLUMN     "thumbnailKey" TEXT;
