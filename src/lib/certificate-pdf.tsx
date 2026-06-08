import 'server-only'
import React from 'react'
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer'

const s = StyleSheet.create({
  page: {
    backgroundColor: '#f5f3f0',
    paddingHorizontal: 64,
    paddingVertical: 52,
    fontFamily: 'Helvetica',
    position: 'relative',
  },
  border: {
    position: 'absolute',
    top: 20, left: 20, right: 20, bottom: 20,
    border: '2pt solid #c96442',
    borderRadius: 8,
  },
  innerBorder: {
    position: 'absolute',
    top: 26, left: 26, right: 26, bottom: 26,
    border: '0.5pt solid #c96442',
    borderRadius: 6,
    opacity: 0.4,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
    marginTop: 8,
  },
  badge: {
    width: 52,
    height: 52,
    backgroundColor: '#c96442',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 28,
    fontFamily: 'Helvetica-Bold',
  },
  org: {
    fontSize: 9,
    letterSpacing: 2.5,
    color: '#c96442',
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  dividerTop: {
    width: 40,
    height: 1.5,
    backgroundColor: '#c96442',
    marginTop: 10,
    opacity: 0.5,
  },
  title: {
    fontSize: 32,
    fontFamily: 'Helvetica-Bold',
    color: '#1c2233',
    textAlign: 'center',
    letterSpacing: 1,
    marginTop: 28,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 10,
    letterSpacing: 2,
    color: '#888d99',
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 28,
  },
  body: {
    fontSize: 13,
    color: '#5b6271',
    textAlign: 'center',
    lineHeight: 1.7,
    marginBottom: 6,
  },
  name: {
    fontSize: 30,
    fontFamily: 'Helvetica-Bold',
    color: '#1c2233',
    textAlign: 'center',
    marginVertical: 14,
    letterSpacing: 0.5,
  },
  courseLine: {
    fontSize: 14,
    color: '#1c2233',
    textAlign: 'center',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  courseOrg: {
    fontSize: 11,
    color: '#5b6271',
    textAlign: 'center',
    marginBottom: 32,
  },
  divider: {
    height: 1,
    backgroundColor: '#d8dadf',
    marginHorizontal: 40,
    marginBottom: 24,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
  },
  footerBlock: {
    alignItems: 'center',
    minWidth: 120,
  },
  footerLine: {
    width: 100,
    height: 0.75,
    backgroundColor: '#888d99',
    marginBottom: 4,
  },
  footerLabel: {
    fontSize: 8,
    color: '#888d99',
    letterSpacing: 1,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  footerValue: {
    fontSize: 9,
    color: '#3d4555',
    textAlign: 'center',
    marginTop: 2,
  },
  certNum: {
    fontSize: 9,
    color: '#888d99',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
})

function CertificateDoc({ name, certNumber, issuedAt }: {
  name: string
  certNumber: number
  issuedAt: string
}) {
  const date = new Date(issuedAt).toLocaleDateString('ru-RU', {
    day: '2-digit', month: 'long', year: 'numeric',
  })

  return (
    <Document title={`Сертификат INCF — ${name}`}>
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.border} />
        <View style={s.innerBorder} />

        <View style={s.header}>
          <View style={s.badge}>
            <Text style={s.badgeText}>i</Text>
          </View>
          <Text style={s.org}>International Neurological Coaching Federation</Text>
          <View style={s.dividerTop} />
        </View>

        <Text style={s.title}>СЕРТИФИКАТ</Text>
        <Text style={s.subtitle}>об успешном прохождении курса</Text>

        <Text style={s.body}>Настоящим подтверждается, что</Text>
        <Text style={s.name}>{name}</Text>
        <Text style={s.body}>успешно прошёл(а) онлайн-курс</Text>
        <Text style={s.courseLine}>«Введение в нейрокоучинг»</Text>
        <Text style={s.courseOrg}>INCF — International Neurological Coaching Federation</Text>

        <View style={s.divider} />

        <View style={s.footer}>
          <View style={s.footerBlock}>
            <View style={s.footerLine} />
            <Text style={s.footerLabel}>Дата выдачи</Text>
            <Text style={s.footerValue}>{date}</Text>
          </View>
          <View style={s.footerBlock}>
            <Text style={s.certNum}>№ {certNumber}</Text>
          </View>
          <View style={s.footerBlock}>
            <View style={s.footerLine} />
            <Text style={s.footerLabel}>Директор программы</Text>
            <Text style={s.footerValue}>Alexandra Boldina</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}

export async function generateCertificatePDF(
  name: string,
  certNumber: number,
  issuedAt: string,
): Promise<Buffer> {
  const element = React.createElement(CertificateDoc, { name, certNumber, issuedAt })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return renderToBuffer(element as any) as Promise<Buffer>
}
