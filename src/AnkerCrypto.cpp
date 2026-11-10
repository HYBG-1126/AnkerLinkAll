#include "AnkerCrypto.h"

#include <openssl/core_names.h>
#include <openssl/ec.h>
#include <openssl/evp.h>
#include <openssl/param_build.h>

namespace AnkerCrypto {

namespace {
constexpr int kTagLength = 16;

const auto *uc(const QByteArray &bytes)
{
    return reinterpret_cast<const unsigned char *>(bytes.constData());
}
} // namespace

QByteArray aesGcmEncrypt(const QByteArray &plain, const QByteArray &key, const QByteArray &nonce,
                         const QByteArray &aad)
{
    EVP_CIPHER_CTX *ctx = EVP_CIPHER_CTX_new();
    if (!ctx)
        return {};
    QByteArray out(plain.size() + kTagLength, Qt::Uninitialized);
    auto *buffer = reinterpret_cast<unsigned char *>(out.data());
    int length = 0;
    int total = 0;
    bool ok = EVP_EncryptInit_ex(ctx, EVP_aes_128_gcm(), nullptr, nullptr, nullptr) == 1
              && EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_SET_IVLEN, int(nonce.size()), nullptr) == 1
              && EVP_EncryptInit_ex(ctx, nullptr, nullptr, uc(key), uc(nonce)) == 1
              && EVP_EncryptUpdate(ctx, nullptr, &length, uc(aad), int(aad.size())) == 1
              && EVP_EncryptUpdate(ctx, buffer, &length, uc(plain), int(plain.size())) == 1;
    total = length;
    ok = ok && EVP_EncryptFinal_ex(ctx, buffer + total, &length) == 1;
    total += length;
    ok = ok && EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_GET_TAG, kTagLength, buffer + total) == 1;
    EVP_CIPHER_CTX_free(ctx);
    if (!ok)
        return {};
    out.resize(total + kTagLength);
    return out;
}

std::optional<QByteArray> aesGcmDecrypt(const QByteArray &cipherWithTag, const QByteArray &key,
                                        const QByteArray &nonce, const QByteArray &aad)
{
    if (cipherWithTag.size() < kTagLength)
        return std::nullopt;
    const QByteArray cipher = cipherWithTag.left(cipherWithTag.size() - kTagLength);
    QByteArray tag = cipherWithTag.right(kTagLength);
    EVP_CIPHER_CTX *ctx = EVP_CIPHER_CTX_new();
    if (!ctx)
        return std::nullopt;
    QByteArray out(qMax<qsizetype>(cipher.size(), 1), Qt::Uninitialized);
    auto *buffer = reinterpret_cast<unsigned char *>(out.data());
    int length = 0;
    int total = 0;
    bool ok = EVP_DecryptInit_ex(ctx, EVP_aes_128_gcm(), nullptr, nullptr, nullptr) == 1
              && EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_SET_IVLEN, int(nonce.size()), nullptr) == 1
              && EVP_DecryptInit_ex(ctx, nullptr, nullptr, uc(key), uc(nonce)) == 1
              && EVP_DecryptUpdate(ctx, nullptr, &length, uc(aad), int(aad.size())) == 1
              && EVP_DecryptUpdate(ctx, buffer, &length, uc(cipher), int(cipher.size())) == 1;
    total = length;
    ok = ok && EVP_CIPHER_CTX_ctrl(ctx, EVP_CTRL_GCM_SET_TAG, kTagLength, tag.data()) == 1;
    ok = ok && EVP_DecryptFinal_ex(ctx, buffer + total, &length) == 1;
    total += length;
    EVP_CIPHER_CTX_free(ctx);
    if (!ok)
        return std::nullopt;
    out.resize(total);
    return out;
}

EcdhKeyPair::EcdhKeyPair()
{
    m_key = EVP_EC_gen("prime256v1");
}

EcdhKeyPair::~EcdhKeyPair()
{
    EVP_PKEY_free(static_cast<EVP_PKEY *>(m_key));
}

QByteArray EcdhKeyPair::publicCoordinates() const
{
    if (!m_key)
        return {};
    unsigned char encoded[65];
    size_t length = 0;
    if (EVP_PKEY_get_octet_string_param(static_cast<EVP_PKEY *>(m_key),
                                        OSSL_PKEY_PARAM_ENCODED_PUBLIC_KEY, encoded,
                                        sizeof(encoded), &length)
            != 1
        || length != 65 || encoded[0] != 0x04)
        return {};
    return QByteArray(reinterpret_cast<const char *>(encoded + 1), 64);
}

std::optional<QByteArray> EcdhKeyPair::sharedSecret(const QByteArray &peerCoordinates) const
{
    if (!m_key || peerCoordinates.size() != 64)
        return std::nullopt;
    QByteArray encoded(1, char(0x04));
    encoded.append(peerCoordinates);

    OSSL_PARAM_BLD *builder = OSSL_PARAM_BLD_new();
    OSSL_PARAM_BLD_push_utf8_string(builder, OSSL_PKEY_PARAM_GROUP_NAME, "prime256v1", 0);
    OSSL_PARAM_BLD_push_octet_string(builder, OSSL_PKEY_PARAM_PUB_KEY, encoded.constData(),
                                     size_t(encoded.size()));
    OSSL_PARAM *params = OSSL_PARAM_BLD_to_param(builder);
    OSSL_PARAM_BLD_free(builder);

    EVP_PKEY *peer = nullptr;
    EVP_PKEY_CTX *fromCtx = EVP_PKEY_CTX_new_from_name(nullptr, "EC", nullptr);
    bool ok = fromCtx && EVP_PKEY_fromdata_init(fromCtx) == 1
              && EVP_PKEY_fromdata(fromCtx, &peer, EVP_PKEY_PUBLIC_KEY, params) == 1;
    EVP_PKEY_CTX_free(fromCtx);
    OSSL_PARAM_free(params);
    if (!ok) {
        EVP_PKEY_free(peer);
        return std::nullopt;
    }

    EVP_PKEY_CTX *deriveCtx = EVP_PKEY_CTX_new(static_cast<EVP_PKEY *>(m_key), nullptr);
    size_t length = 0;
    ok = deriveCtx && EVP_PKEY_derive_init(deriveCtx) == 1
         && EVP_PKEY_derive_set_peer(deriveCtx, peer) == 1
         && EVP_PKEY_derive(deriveCtx, nullptr, &length) == 1;
    QByteArray secret(qsizetype(length), Qt::Uninitialized);
    ok = ok
         && EVP_PKEY_derive(deriveCtx, reinterpret_cast<unsigned char *>(secret.data()), &length)
                == 1;
    EVP_PKEY_CTX_free(deriveCtx);
    EVP_PKEY_free(peer);
    if (!ok || length != 32)
        return std::nullopt;
    return secret;
}

} // namespace AnkerCrypto
