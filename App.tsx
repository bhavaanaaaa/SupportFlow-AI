
import React, { useEffect, useState } from 'react'
import './App.css'

type Ticket = {
  id: number
  title: string
  description: string
  customer_email: string
  priority: string
  status: string
  category: string
}

const API_URL = 'http://127.0.0.1:8000'

function App() {
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formMessage, setFormMessage] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [replyTicketId, setReplyTicketId] = useState<number | null>(null)
  const [suggestedReply, setSuggestedReply] = useState('')
  const [replyLoading, setReplyLoading] = useState(false)
  const [replyError, setReplyError] = useState('')
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function fetchTickets() {
    try {
      setError('')
      const response = await fetch(`${API_URL}/tickets`)

      if (!response.ok) {
        throw new Error('Could not load tickets')
      }

      const data: Ticket[] = await response.json()
      setTickets(data)
    } catch {
      setError('Cannot connect to the backend. Check that FastAPI is running.')
    } finally {
      setLoading(false)
    }
  }

  async function createTicket(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setFormMessage('')

    try {
      const response = await fetch(`${API_URL}/tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          description,
          customer_email: email,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(
          errorData.detail?.[0]?.msg || 'Could not create ticket',
        )
      }

      await fetchTickets()
      setTitle('')
      setDescription('')
      setEmail('')
      setShowForm(false)
      setFormMessage('Ticket created successfully!')
    } catch (error) {
      setFormMessage(
        error instanceof Error ? error.message : 'Something went wrong',
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function updateTicketStatus(ticketId: number, newStatus: string) {
    try {
      const response = await fetch(
        `${API_URL}/tickets/${ticketId}/status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: newStatus }),
        },
      )

      if (!response.ok) {
        throw new Error('Could not update ticket status')
      }

      await fetchTickets()
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Something went wrong',
      )
    }
  }

  async function generateReply(ticketId: number) {
    setReplyTicketId(ticketId)
    setSuggestedReply('')
    setReplyError('')
    setReplyLoading(true)

    try {
      const response = await fetch(
        `${API_URL}/tickets/${ticketId}/suggest-reply`,
        { method: 'POST' },
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.detail || 'Could not generate reply')
      }

      const data: { suggested_reply: string } = await response.json()
      setSuggestedReply(data.suggested_reply)
    } catch (error) {
      setReplyError(
        error instanceof Error ? error.message : 'Something went wrong',
      )
    } finally {
      setReplyLoading(false)
    }
  }

  useEffect(() => {
    void fetchTickets()
  }, [])

  return (
    <main className="app">
      <header className="topbar">
        <div className="brand-icon">S</div>
        <div>
          <h1>SupportFlow AI</h1>
          <p>Customer Support Workspace</p>
        </div>
        <span className="connection">
          <span className="status-dot" /> Support dashboard
        </span>
      </header>

      <section className="welcome">
        <p className="eyebrow">OVERVIEW</p>
        <h2>Good day 👋</h2>
        <p>Manage and track customer support requests in one place.</p>
      </section>

      <section className="stats">
        <article className="stat-card">
          <span>Total tickets</span>
          <strong>{tickets.length}</strong>
        </article>
        <article className="stat-card">
          <span>Open tickets</span>
          <strong>
            {tickets.filter((ticket) => ticket.status === 'open').length}
          </strong>
        </article>
        <article className="stat-card">
          <span>In Progress</span>
          <strong>
            {tickets.filter((ticket) => ticket.status === 'in progress').length}
          </strong>
        </article>
        <article className="stat-card">
          <span>Delivery tickets</span>
          <strong>{tickets.filter((ticket) => ticket.category === 'Delivery').length}</strong>
        </article>
      </section>

      <section className="ticket-section">
        <div className="create-heading">
          <div>
            <h2>Create a ticket</h2>
            <p>Submit a new customer support request.</p>
          </div>
          <button type="button" onClick={() => {
            setShowForm(!showForm)
            setFormMessage('')
          }}>
            {showForm ? 'Cancel' : '+ Create Ticket'}
          </button>
        </div>

        {showForm && (
          <form className="ticket-form" onSubmit={createTicket}>
            <label>
              Ticket title
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                minLength={3}
                maxLength={150}
                placeholder="e.g. Order not delivered"
                required
              />
            </label>

            <label>
              Customer email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="customer@example.com"
                required
              />
            </label>

            <label>
              Description
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                minLength={5}
                maxLength={3000}
                rows={4}
                placeholder="Describe the customer's issue..."
                required
              />
            </label>

            <button type="submit" disabled={submitting}>
              {submitting ? 'Creating...' : 'Submit Ticket'}
            </button>
          </form>
        )}

        {formMessage && <p className="form-message">{formMessage}</p>}
        <div className="section-heading">
          <div>
            <h2>Recent tickets</h2>
            <p>Customer requests from your support API</p>
          </div>
          <button onClick={() => {
            setLoading(true)
            void fetchTickets()
          }}>
            Refresh
          </button>
        </div>

        {loading && <p className="message">Loading tickets...</p>}
        {error && <p className="error">{error}</p>}

        {!loading && !error && tickets.length === 0 && (
          <p className="message">No tickets yet. Create one through the API to get started.</p>
        )}

        {!loading && !error && tickets.length > 0 && (
          <>
            <div className="filter-bar">
              <label htmlFor="category-filter">Filter by category</label>
              <select
                id="category-filter"
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
              >
                <option value="All">All categories</option>
                <option value="Delivery">Delivery</option>
                <option value="Billing">Billing</option>
                <option value="Technical Support">Technical Support</option>
                <option value="General Inquiry">General Inquiry</option>
              </select>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Ticket</th>
                    <th>Customer</th>
                    <th>Category</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>AI Reply</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets
                    .filter(
                      (ticket) =>
                        categoryFilter === 'All' || ticket.category === categoryFilter,
                    )
                    .map((ticket) => (
                      <tr key={ticket.id}>
                        <td>
                          <strong>#{ticket.id} · {ticket.title}</strong>
                          <p className="description">{ticket.description}</p>
                        </td>
                        <td>{ticket.customer_email}</td>
                        <td><span className="category">{ticket.category}</span></td>
                        <td>{ticket.priority}</td>
                        <td>
                          <select
                            className="status-select"
                            value={ticket.status}
                            onChange={(event) =>
                              void updateTicketStatus(ticket.id, event.target.value)
                            }
                          >
                            <option value="open">Open</option>
                            <option value="in progress">In Progress</option>
                            <option value="resolved">Resolved</option>
                          </select>
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => void generateReply(ticket.id)}
                          >
                            Suggest Reply
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {replyTicketId !== null && (
          <div className="reply-panel">
            <h2>Suggested reply · Ticket #{replyTicketId}</h2>

            {replyLoading && <p>Preparing reply...</p>}
            {replyError && <p className="error">{replyError}</p>}

            {suggestedReply && (
              <>
                <textarea
                  rows={5}
                  value={suggestedReply}
                  onChange={(event) => setSuggestedReply(event.target.value)}
                  aria-label="Edit suggested reply"
                />

                <p className="reply-note">
                  Review and edit this draft before sending it to the customer.
                </p>

                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(suggestedReply)
                  }}
                >
                  Copy Reply
                </button>
              </>
            )}
          </div>
        )}
      </section>
      <footer>SupportFlow AI · Built with React, TypeScript and FastAPI</footer>
    </main>
  )
}

export default App
