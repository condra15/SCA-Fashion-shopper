const extpay = ExtPay("color-analysis-shopper");

const $email = document.querySelector(".email");
const $status = document.querySelector(".status");
const $manage = document.querySelector(".manage");

window.onload = function () {
  userpull();
};

$manage.addEventListener("click", function (evt) {
  evt.preventDefault();
  extpay.getUser().then((user) => {
    if (!user.trialStartedAt && !user.paid) {
      // Have user create trial account
      extpay.openTrialPage("14 day");
    } else {
      // Have user pay for extension
      extpay.openPaymentPage();
    }
  });
});

function userpull() {
  extpay
    .getUser()
    .then((user) => {
      if (user) {
        $email.innerHTML = user.email;
        $status.innerHTML = user.subscriptionStatus
          ? user.subscriptionStatus
          : "Click below to subscribe!";
      } else {
        $email.innerHTML = "Please create an account";
        $status.innerHTML = "None";
      }
    })
    .catch((err) => {
      $email.innerHTML = "Network error";
      $status.innerHTML = "-";
    });
}
