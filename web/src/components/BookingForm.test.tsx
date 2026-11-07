import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BookingForm } from './BookingForm';
import { AssistantProvider } from '../hooks/useAssistant';

vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ open: true, slots: ['10:00'], branch: { name: 'Project 6 Branch', address: 'x', hours: 'y' } }))));

const setup = () =>
  render(
    <MemoryRouter>
      <AssistantProvider>
        <BookingForm preselect={null} />
      </AssistantProvider>
    </MemoryRouter>,
  );

describe('BookingForm', () => {
  it('does not nag about an empty field the visitor just tabbed past', () => {
    setup();
    const name = screen.getByLabelText('Full name');
    fireEvent.focus(name);
    fireEvent.blur(name);
    expect(screen.queryByText('Enter your full name.')).toBeNull();
  });

  it('does check a field they typed into when they leave it', () => {
    setup();
    const phone = screen.getByLabelText('Mobile number');
    fireEvent.change(phone, { target: { value: '0917' } });
    fireEvent.blur(phone);
    expect(screen.getAllByText(/Philippine mobile number/).length).toBeGreaterThan(0);
  });

  it('keeps focus on press of Confirm so the layout cannot shift under the click', () => {
    setup();
    const confirm = screen.getByRole('button', { name: 'Confirm appointment' });
    // fireEvent returns false when the event's default was prevented (focus stays where it was)
    expect(fireEvent.mouseDown(confirm)).toBe(false);
  });

  it('submitting an empty form lists what to fix', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm appointment' }));
    expect(screen.getByRole('alert').textContent).toMatch(/Please fix/);
  });
});
