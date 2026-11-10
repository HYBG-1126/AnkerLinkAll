#pragma once

#include <QByteArray>
#include <optional>

namespace AnkerCrypto {

QByteArray aesGcmEncrypt(const QByteArray &plain, const QByteArray &key, const QByteArray &nonce,
                         const QByteArray &aad);
std::optional<QByteArray> aesGcmDecrypt(const QByteArray &cipherWithTag, const QByteArray &key,
                                        const QByteArray &nonce, const QByteArray &aad);

class EcdhKeyPair
{
public:
    EcdhKeyPair();
    ~EcdhKeyPair();
    EcdhKeyPair(const EcdhKeyPair &) = delete;
    EcdhKeyPair &operator=(const EcdhKeyPair &) = delete;

    bool isValid() const { return m_key != nullptr; }
    // 64 字节 X||Y 坐标（不含 0x04 前缀）
    QByteArray publicCoordinates() const;
    std::optional<QByteArray> sharedSecret(const QByteArray &peerCoordinates) const;

private:
    void *m_key = nullptr;
};

} // namespace AnkerCrypto
