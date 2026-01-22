import { fireEvent, screen } from "@testing-library/dom"
import Bills from "../containers/Bills"
import BillsUI from "../views/BillsUI"
import { ROUTES_PATH } from "../constants/routes"

describe("Bills – Navigation et interactions utilisateur", () => {
    test("Quand je clique sur 'New Bill', alors je navigue vers la page NewBill", () => {
        // Given : un bouton New Bill dans le DOM et un container Bills instancié
        document.body.innerHTML = `<button data-testid="btn-new-bill">New</button>`
        const onNavigate = jest.fn()

        new Bills({
            document,
            onNavigate,
            store: null,
            localStorage: window.localStorage
        })

        // When : l'utilisateur clique sur le bouton
        fireEvent.click(screen.getByTestId("btn-new-bill"))

        // Then : la navigation vers NewBill est déclenchée
        expect(onNavigate).toHaveBeenCalledWith(ROUTES_PATH["NewBill"])
    })

    test("Quand je clique sur l’icône œil, alors handleClickIconEye est appelée", () => {
        // Given : une icône eye associée à une facture
        document.body.innerHTML = `<div data-testid="icon-eye" data-bill-url="http://x/test.png"></div>`
        const onNavigate = jest.fn()

        const billsContainer = new Bills({
            document,
            onNavigate,
            store: null,
            localStorage: window.localStorage
        })

        // Spy sur la méthode appelée lors du clic
        const spy = jest.spyOn(billsContainer, "handleClickIconEye")

        // When : clic sur l’icône
        fireEvent.click(screen.getByTestId("icon-eye"))

        // Then : la méthode est bien déclenchée
        expect(spy).toHaveBeenCalled()
    })
})


describe("Bills – Récupération et formatage des données (getBills)", () => {
    test("Quand getBills est appelé avec des données valides, alors les factures sont formatées", async () => {
        // Given : un store mocké retournant une facture avec une date valide
        const store = {
            bills: () => ({
                list: jest.fn().mockResolvedValue([
                    {
                        id: "1",
                        date: "2020-01-01",
                        status: "pending"
                    }
                ])
            })
        }

        const onNavigate = jest.fn()

        const billsContainer = new Bills({
            document,
            onNavigate,
            store,
            localStorage: window.localStorage
        })

        // When : appel de la méthode getBills
        const bills = await billsContainer.getBills()

        // Then : les données sont bien retournées et exploitables
        expect(bills).toBeTruthy()
        expect(bills[0].date).toBeTruthy()
        expect(bills[0].status).toBeTruthy()
    })

    test("Quand le formatage de la date échoue, alors la date brute est conservée", async () => {
        // Given : une facture avec une date invalide
        const store = {
            bills: () => ({
                list: jest.fn().mockResolvedValue([
                    {
                        id: "2",
                        date: "not-a-date",
                        status: "pending"
                    }
                ])
            })
        }

        const onNavigate = jest.fn()

        const billsContainer = new Bills({
            document,
            onNavigate,
            store,
            localStorage: window.localStorage
        })

        // When : appel de getBills
        const bills = await billsContainer.getBills()

        // Then : la date non formatable est conservée telle quelle
        expect(bills[0].date).toBe("not-a-date")
    })

})

describe("Bills – Test d’intégration GET Bills", () => {
    test("Quand la page Bills récupère les données, alors l’API GET est appelée", async () => {
        // Given : un store mocké simulant l’API
        const listMock = jest.fn(() =>
            Promise.resolve([
                {
                    id: "1",
                    date: "2023-12-01",
                    status: "pending",
                    name: "Taxi",
                    amount: 42
                }
            ])
        )

        const store = {
            bills: () => ({
                list: listMock
            })
        }

        const onNavigate = jest.fn()

        // UI Bills montée comme en production
        document.body.innerHTML = BillsUI({
            data: [],
            loading: false,
            error: null
        })

        const billsContainer = new Bills({
            document,
            onNavigate,
            store,
            localStorage: window.localStorage
        })

        // When : la page déclenche la récupération des factures
        const bills = await billsContainer.getBills()

        // Then : l’API GET est bien appelée et les données sont récupérées
        expect(listMock).toHaveBeenCalled()
        expect(bills.length).toBe(1)
        expect(bills[0].name).toBe("Taxi")
    })

})
