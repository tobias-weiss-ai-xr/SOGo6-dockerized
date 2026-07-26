import { NextResponse } from 'next/server'
import domainList from '../../../domainList.json'

export async function GET() {
  return NextResponse.json(domainList)
}

// OPTIONS for preflight (CORS, etc.)
export async function OPTIONS() {
  return NextResponse.json({ allow: ['GET'] }, { status: 200 })
}

//POST to add new domain. There is no domain_id
export async function POST(request: Request) {
  const reqBody = await request.json()
  )
  return NextResponse.json({ success: true, data: reqBody })
}
